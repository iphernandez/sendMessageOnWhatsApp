import { launch } from 'Puppeteer';

export class WhatsAppHandler {
    private whatsappUrl = 'https://web.whatsapp.com/';

    public constructor() {}

    public async sendWhatsappMessage(groupName: string, message: string) {
        const browser = await launch({ headless: false });
        const page = await browser.newPage();
        await page.goto(this.whatsappUrl, { waitUntil: 'networkidle0' });

        // Wait for user to log in
        await page.waitForSelector('._3NWy8');
        console.log('Logged in to WhatsApp Web');

        // Search for the group
        await page.type('._3FRCZ', groupName); // Search input field
        //await page.waitForResponse(2000); // Wait for search results to appear
        setTimeout(() => {}, 3000);
        await page.click(`span[title="${groupName}"]`); // Click on the group

        // Wait for chat to load
        await page.waitForSelector('._3FRCZ');

        // Type and send the message
        await page.type('div[data-tab="1"]', message);
        await page.keyboard.press('Enter');
        console.log(`Message "${message}" sent to group "${groupName}"`);

        // Close the browser
        await browser.close();
    }
}
