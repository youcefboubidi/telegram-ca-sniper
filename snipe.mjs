import puppeteer from 'puppeteer';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

(async () => {
    console.log('Launching Telegram Web...');

    const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
    const page = await browser.newPage();

    await page.goto('https://web.telegram.org/', { waitUntil: 'networkidle2' });

    console.log('Please log in manually and open the target channel.');
    await new Promise((resolve) => rl.question('Press Enter after you have the channel open... ', resolve));
    rl.close();

    console.log('Monitoring messages...');

    const dismissedMessages = new Set();

    while (true) {
        try {
            const messages = await page.evaluate(() => {
                let elements = document.querySelectorAll('.text-content, .translatable-message');
                return Array.from(elements).map((el) => el.innerText);
            });

            if (messages.length > 0) {
                let lastMessage = messages[messages.length - 1];

                if (dismissedMessages.has(lastMessage)) {
                    continue;
                }

                console.log('Last message:', lastMessage);

                let isCA = false;
                let CA;
                const match = lastMessage.match(/\b[a-zA-Z0-9]{43}\b/);
                const match2 = lastMessage.match(/\b[a-zA-Z0-9]{44}\b/);

                if (match2) {
                    CA = match2[0];
                    isCA = true;
                } else if (match) {
                    CA = match[0];
                    isCA = true;
                }

                if (isCA) {

                    await page.evaluate((text) => {
                        navigator.clipboard.writeText(text);
                    }, CA);


                    await switchTabPasteCA(browser, CA);
                    break;
                } else {
                    console.log("Non-CA message detected, content:", lastMessage);
                    dismissedMessages.add(lastMessage);
                    console.log("Dismissed.");
                }
            }
        } catch (err) {
            console.error('Error reading messages:', err);
        }
    }

    console.log('Process finished.');
})();


async function switchTabPasteCA(browser, CA) {

    const pages = await browser.pages();
    console.log("Tabs open:", pages.length);


    for (let i = 0; i < pages.length; i++) {
        const url = await pages[i].url();
        console.log(`Tab ${i}: ${url}`);
    }

    if (pages.length < 2) {
        console.log("Only one tab open. Cannot switch to another.");
        return;
    }


    const currentPage = pages[0];
    let nextPageIndex = (pages.indexOf(currentPage) + 1) % pages.length;
    const nextPage = pages[nextPageIndex];
    console.log("Switching to tab", nextPageIndex, "with URL:", await nextPage.url());

    await nextPage.bringToFront();
    try {
        await nextPage.waitForSelector('#editable-message-text, div[contenteditable="true"]', { visible: true, timeout: 60000 });
        console.log("Found the input field!");
    } catch (error) {
        console.error("Failed to find the input field:", error);
        return;
    }


    await nextPage.evaluate(() => {
        const inputField = document.querySelector('#editable-message-text, div[contenteditable="true"]');
        if (inputField) {
            inputField.focus();
        }
    });

    await nextPage.keyboard.type(CA, { delay: 0 });


    await nextPage.keyboard.press('Enter');
}
