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
     * Find a WhatsApp group chat by its name.
     * @param {string} groupName - The name of the group to find.
     * @returns {Promise<object>} The group chat object.
     */
    async findGroup(groupName) {
        const chats = await this.client.getChats();
        const group = chats.find(
            (chat) => chat.isGroup && chat.name === groupName
        );

        if (!group) {
            throw new Error(`Group "${groupName}" not found.`);
        }

        console.log(`Found group: "${group.name}" (${group.id._serialized})`);
        return group;
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
     * Gracefully destroy the WhatsApp client session.
     * @returns {Promise<void>}
     */
    async destroy() {
        await this.client.destroy();
        console.log('WhatsApp client session closed.');
    }
}
