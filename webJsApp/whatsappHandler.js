import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia, Poll } = pkg;
import qrcode from 'qrcode-terminal';

export class WhatsAppHandler {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: false,
            },
        });
        this.isReady = false;
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
                resolve();
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
            const chats = await this.client.getChats();
            const group = chats.find(
                (chat) => chat.isGroup && chat.name === groupName
            );

            if (group) {
                console.log(`Found group: "${group.name}" (${group.id._serialized})`);
                return group;
            }

            if (attempt < retries) {
                console.log(`Group "${groupName}" not found yet, retrying in ${delayMs / 1000}s... (${attempt}/${retries})`);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
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
        const group = await this.findGroup(groupName);
        await group.sendMessage(message);
        await new Promise((resolve) => setTimeout(resolve, 3000));
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
        const group = await this.findGroup(groupName);
        const media = MessageMedia.fromFilePath(filePath);
        await group.sendMessage(media, { caption });
        await new Promise((resolve) => setTimeout(resolve, 3000));
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
        const group = await this.findGroup(groupName);
        const { allowMultipleAnswers = false } = options;

        const poll = new Poll(pollName, pollOptions, {
            allowMultipleAnswers,
        });

        const sentMessage = await group.sendMessage(poll);
        await new Promise((resolve) => setTimeout(resolve, 3000));
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
        const group = await this.findGroup(groupName);

        // Open the chat so WhatsApp Web loads the chat object internally.
        // Without this, PollsSendVote.sendVote fails with
        // "Cannot read properties of undefined (reading 'waitForChatLoading')".
        await group.sendSeen();
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Fetch recent messages to find the poll
        const messages = await group.fetchMessages({ limit: 50 });
        const pollMessage = messages
            .reverse()
            .find(
                (msg) =>
                    msg.type === 'poll_creation' &&
                    msg.body === pollName
            );

        if (!pollMessage) {
            throw new Error(
                `Poll "${pollName}" not found in recent messages of group "${groupName}".`
            );
        }

        // Vote on the poll
        await pollMessage.vote(selectedOptions);
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
    async getPollOptionVoters(groupName, pollName, optionText) {
        const group = await this.findGroup(groupName);

        const messages = await group.fetchMessages({ limit: 50 });
        const pollMessage = messages
            .reverse()
            .find(
                (msg) =>
                    msg.type === 'poll_creation' &&
                    msg.body === pollName
            );

        if (!pollMessage) {
            throw new Error(
                `Poll "${pollName}" not found in recent messages of group "${groupName}".`
            );
        }

        const votes = typeof pollMessage.getPollVotes === 'function'
            ? await pollMessage.getPollVotes()
            : (pollMessage.votes ?? []);

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
