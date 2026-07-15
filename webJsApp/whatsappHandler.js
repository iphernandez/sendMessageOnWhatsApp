import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';

export class WhatsAppHandler {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: false,
                defaultViewport: null,
                args: [
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-default-apps',
                    '--disable-session-crashed-bubble',
                ],
            },
        });
        this.isReady = false;
    }

    async delay(ms) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

    formatErrorDetails(error) {
        if (error instanceof Error) {
            return error.stack || error.message;
        }

        if (typeof error === 'string') {
            return error;
        }

        try {
            return JSON.stringify(error, null, 2);
        } catch {
            return String(error);
        }
    }

    async cleanupExtraPages() {
        const browser = this.client.pupBrowser;
        const primaryPage = this.client.pupPage;

        if (!browser || !primaryPage) {
            return;
        }

        const pages = await browser.pages();
        const extraPages = pages.filter((page) => page !== primaryPage && !page.isClosed());

        for (const page of extraPages) {
            try {
                await page.close();
            } catch {
                // Ignore startup page races while Chromium is still settling.
            }
        }
    }

    async findGroupDescriptor(groupName) {
        return this.client.pupPage.evaluate((targetGroupName) => {
            const normalize = (value) => String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim()
                .toLowerCase();

            const targetName = normalize(targetGroupName);
            const chats = window.require('WAWebCollections').Chat.getModelsArray();

            const matchedChat = chats.find((chat) => {
                if (!chat?.groupMetadata) {
                    return false;
                }

                const candidates = [chat.name, chat.formattedTitle, chat.groupMetadata?.subject];
                return candidates.some((candidate) => normalize(candidate) === targetName);
            });

            if (!matchedChat?.id?._serialized) {
                return null;
            }

            return {
                id: matchedChat.id._serialized,
                name: matchedChat.formattedTitle || matchedChat.name || matchedChat.groupMetadata?.subject || targetGroupName,
            };
        }, groupName);
    }

    async runGroupCommand(groupId, command, payload = {}) {
        return this.client.pupPage.evaluate(
            async (targetGroupId, targetCommand, targetPayload) => {
                const normalize = (value) => String(value || '')
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .trim()
                    .toLowerCase();

                const getChatBySerializedId = (chatId) => {
                    const wid = window.require('WAWebWidFactory').createWid(chatId);

                    return (
                        window.require('WAWebCollections').Chat.get(wid) ||
                        window.require('WAWebCollections').Chat.getModelsArray().find(
                            (chat) => chat?.id?._serialized === chatId
                        )
                    );
                };

                const getRecentMessages = async (chat, limit) => {
                    const msgFilter = (msg) => !msg.isNotification;
                    let messages = chat.msgs.getModelsArray().filter(msgFilter);

                    while (messages.length < limit) {
                        const loadedMessages = await window
                            .require('WAWebChatLoadMessages')
                            .loadEarlierMsgs({ chat });

                        if (!loadedMessages || !loadedMessages.length) {
                            break;
                        }

                        messages = [...loadedMessages.filter(msgFilter), ...messages];
                    }

                    if (messages.length > limit) {
                        messages.sort((a, b) => (a.t > b.t ? 1 : -1));
                        messages = messages.splice(messages.length - limit);
                    }

                    return messages;
                };

                const chat = getChatBySerializedId(targetGroupId);
                if (!chat) {
                    throw new Error(`Group chat with id "${targetGroupId}" is not available.`);
                }

                if (targetCommand === 'sendSeen') {
                    window.require('WAWebStreamModel').Stream.markAvailable();
                    await window.require('WAWebUpdateUnreadChatAction').sendSeen({
                        chat,
                        threadId: undefined,
                    });
                    window.require('WAWebStreamModel').Stream.markUnavailable();
                    return true;
                }

                if (targetCommand === 'sendTextMessage') {
                    const msg = await window.WWebJS.sendMessage(chat, targetPayload.message, {
                        linkPreview: true,
                        parseVCards: true,
                    });
                    return msg ? window.WWebJS.getMessageModel(msg) : null;
                }

                if (targetCommand === 'sendMediaMessage') {
                    const msg = await window.WWebJS.sendMessage(chat, '', {
                        media: targetPayload.media,
                        caption: targetPayload.caption,
                    });
                    return msg ? window.WWebJS.getMessageModel(msg) : null;
                }

                if (targetCommand === 'createPoll') {
                    const pollOptions = (targetPayload.pollOptions || []).map((option, index) => ({
                        name: String(option || '').trim(),
                        localId: index,
                    }));

                    const msg = await window.WWebJS.sendMessage(chat, '', {
                        poll: {
                            pollName: targetPayload.pollName,
                            pollOptions,
                            options: {
                                allowMultipleAnswers: targetPayload.allowMultipleAnswers,
                            },
                        },
                    });
                    return msg ? window.WWebJS.getMessageModel(msg) : null;
                }

                if (targetCommand === 'findPollMessage') {
                    const messageLimit = Number(targetPayload.messageLimit) || 50;
                    const targetPollName = normalize(targetPayload.pollName);
                    const messages = await getRecentMessages(chat, messageLimit);

                    const pollMessage = [...messages]
                        .sort((a, b) => (a.t < b.t ? 1 : -1))
                        .find(
                            (msg) =>
                                msg.type === 'poll_creation' &&
                                normalize(msg.body) === targetPollName
                        );

                    return pollMessage ? window.WWebJS.getMessageModel(pollMessage) : null;
                }

                throw new Error(`Unsupported group command: ${targetCommand}`);
            },
            groupId,
            command,
            payload,
        );
    }

    async ensureChatReady(group) {
        await this.runGroupCommand(group.id, 'sendSeen');
        await this.delay(2000);
    }

    async getReadyGroup(groupName) {
        const group = await this.findGroup(groupName);
        await this.ensureChatReady(group);
        return group;
    }

    async findPollMessage(group, pollName, messageLimit = 50) {
        return this.runGroupCommand(group.id, 'findPollMessage', {
            pollName,
            messageLimit,
        });
    }

    async voteOnMessage(messageId, selectedOptions) {
        await this.client.pupPage.evaluate(
            async (targetMessageId, votes) => {
                if (!targetMessageId) {
                    return null;
                }

                const selectedVotes = Array.isArray(votes) ? votes : [votes];
                const localIdSet = new Set();
                const msg =
                    window.require('WAWebCollections').Msg.get(targetMessageId) ||
                    (
                        await window
                            .require('WAWebCollections')
                            .Msg.getMessagesById([targetMessageId])
                    )?.messages?.[0];

                if (!msg) {
                    throw new Error(`Poll message "${targetMessageId}" could not be loaded.`);
                }

                msg.pollOptions.forEach((option) => {
                    for (const vote of selectedVotes) {
                        if (option.name === vote) {
                            localIdSet.add(option.localId);
                        }
                    }
                });

                await window
                    .require('WAWebPollsSendVoteMsgAction')
                    .sendVote(msg, localIdSet);
            },
            messageId,
            selectedOptions,
        );
    }

    normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
    }

    async resolveVoterContact(voterRef) {
        if (!voterRef) {
            return null;
        }

        if (typeof voterRef === 'string') {
            try {
                return await this.client.getContactById(voterRef);
            } catch {
                return null;
            }
        }

        if (typeof voterRef.getContact === 'function') {
            try {
                return await voterRef.getContact();
            } catch {
                return null;
            }
        }

        return null;
    }

    /**
     * Initialize the WhatsApp client, display QR code, and wait until ready.
     * @returns {Promise<void>}
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            this.client.on('qr', (qr) => {
                console.log('Scan the QR code below to log in:');
                qrcode.generate(qr, { small: true });
            });

            this.client.on('authenticated', () => {
                console.log('Authenticated successfully.');
            });

            this.client.on('auth_failure', (msg) => {
                console.error('Authentication failure:', msg);
                reject(new Error('Authentication failed'));
            });

            this.client.on('ready', () => {
                console.log('WhatsApp client is ready!');
                this.isReady = true;
                this.cleanupExtraPages()
                    .catch(() => {})
                    .finally(resolve);
            });

            this.client.initialize();
        });
    }

    /**
     * Find a WhatsApp group chat by its name, retrying a few times to allow
     * chats to finish syncing after the client becomes ready.
     * @param {string} groupName - The name of the group to find.
     * @param {number} [retries=5] - Number of attempts before giving up.
     * @param {number} [delayMs=3000] - Milliseconds to wait between attempts.
     * @returns {Promise<object>} The group chat object.
     */
    async findGroup(groupName, retries = 5, delayMs = 3000) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            const group = await this.findGroupDescriptor(groupName);

            if (group) {
                console.log(`Found group: "${group.name}" (${group.id})`);
                return group;
            }

            if (attempt < retries) {
                console.log(`Group "${groupName}" not found yet, retrying in ${delayMs / 1000}s... (${attempt}/${retries})`);
                await this.delay(delayMs);
            }
        }

        throw new Error(`Group "${groupName}" not found after ${retries} attempts.`);
    }

    /**
     * Send a text message to a WhatsApp group.
     * @param {string} groupName - The target group name.
     * @param {string} message - The message text to send.
     * @returns {Promise<void>}
     */
    async sendMessage(groupName, message) {
        const group = await this.getReadyGroup(groupName);

        try {
            await this.runGroupCommand(group.id, 'sendTextMessage', { message });
        } catch (error) {
            console.error(`Failed to send message to group "${groupName}":`);
            console.error(this.formatErrorDetails(error));
            throw error;
        }

        await this.delay(3000);
        console.log(`Message sent to group "${groupName}".`);
    }

    /**
     * Send a picture (image file) to a WhatsApp group, with an optional caption.
     * @param {string} groupName - The target group name.
     * @param {string} filePath - The path to the image file.
     * @param {string} [caption=''] - Optional caption for the image.
     * @returns {Promise<void>}
     */
    async sendPicture(groupName, filePath, caption = '') {
        const group = await this.getReadyGroup(groupName);
        const media = MessageMedia.fromFilePath(filePath);
        await this.runGroupCommand(group.id, 'sendMediaMessage', { media, caption });
        await this.delay(3000);
        console.log(`Picture "${filePath}" sent to group "${groupName}".`);
    }

    /**
     * Create a poll in a WhatsApp group.
     * @param {string} groupName - The target group name.
     * @param {string} pollName - The poll question/title.
     * @param {string[]} pollOptions - Array of poll option strings.
     * @param {object} [options] - Optional poll settings.
     * @param {boolean} [options.allowMultipleAnswers=false] - Whether multiple answers are allowed.
     * @returns {Promise<object>} The sent message object.
     */
    async createPoll(groupName, pollName, pollOptions, options = {}) {
        const group = await this.getReadyGroup(groupName);
        const { allowMultipleAnswers = false } = options;

        const sentMessage = await this.runGroupCommand(group.id, 'createPoll', {
            pollName,
            pollOptions,
            allowMultipleAnswers,
        });
        await this.delay(3000);
        console.log(`Poll "${pollName}" created in group "${groupName}".`);
        return sentMessage;
    }

    /**
     * Vote on a poll in a WhatsApp group by finding the most recent poll
     * with the given title and selecting specified options.
     * @param {string} groupName - The target group name.
     * @param {string} pollName - The poll question/title to search for.
     * @param {string[]} selectedOptions - Array of option strings to vote for.
     * @returns {Promise<void>}
     */
    async voteOnPoll(groupName, pollName, selectedOptions) {
        const group = await this.getReadyGroup(groupName);
        const pollMessage = await this.findPollMessage(group, pollName, 50);

        if (!pollMessage) {
            throw new Error(
                `Poll "${pollName}" not found in recent messages of group "${groupName}".`
            );
        }

        await this.voteOnMessage(pollMessage.id._serialized, selectedOptions);
        console.log(
            `Voted on poll "${pollName}" with options: [${selectedOptions.join(', ')}]`
        );
    }

    /**
     * Get the list of voters for a specific option in a poll.
     * @param {string} groupName - The target group name.
     * @param {string} pollName - The poll question/title to search for.
     * @param {string} optionText - The poll option text to get voters for.
     * @returns {Promise<{ name: string, number: string }[]>} Array of voters for the specified option.
     */
    async getPollOptionVoters(groupName, pollName, optionText, options = {}) {
        const {
            retries = 5,
            delayMs = 3000,
            messageLimit = 100,
        } = options;

        const group = await this.getReadyGroup(groupName);

        let pollMessage = null;
        for (let attempt = 1; attempt <= retries; attempt += 1) {
            pollMessage = await this.findPollMessage(group, pollName, messageLimit);

            if (pollMessage) {
                break;
            }

            if (attempt < retries) {
                console.log(
                    `Poll "${pollName}" not found yet, retrying in ${delayMs / 1000}s... (${attempt}/${retries})`
                );
                await this.delay(delayMs);
            }
        }

        if (!pollMessage) {
            throw new Error(
                `Poll "${pollName}" not found in recent messages of group "${groupName}" after ${retries} attempts.`
            );
        }

        const votes = await this.client.getPollVotes(pollMessage.id._serialized);

        if (votes.length === 0) {
            console.log(`No votes found for poll "${pollName}".`);
            return [];
        }

        const voters = [];
        for (const vote of votes) {
            const selectedNames = (vote.selectedOptions ?? []).map((opt) =>
                typeof opt === 'string' ? opt : String(opt.name ?? '')
            );

            const matchedOption = selectedNames.some(
                (selectedName) => this.normalizeText(selectedName) === this.normalizeText(optionText)
            );

            if (matchedOption) {
                const contact = await this.resolveVoterContact(vote.voter);
                if (!contact) {
                    continue;
                }
                voters.push({
                    name: contact.pushname || contact.name || contact.number,
                    number: contact.number,
                });
            }
        }

        console.log(
            `Found ${voters.length} voter(s) for option "${optionText}" in poll "${pollName}".`
        );
        return voters;
    }

    /**
     * Gracefully destroy the WhatsApp client session.
     * @returns {Promise<void>}
     */
    async destroy() {
        try {
            await this.client.destroy();
            console.log('WhatsApp client session closed.');
        } catch {
            // Ignore errors during shutdown — the browser may already be closing.
            console.log('Ignore errors during shutdown — the browser may already be closing.');
        }
    }
}
