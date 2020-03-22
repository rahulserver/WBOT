WAPI.waitNewMessages(false, (data) => {
    window.log(data)
    const INTERVAL = intents.bot.interval; // 3000 ms;
    for (var i = 0; i < data.length; i++) {
        let message = data[i];
        //fetch API to send and receive response from server
        body = {};
        body.text = message.body;
        body.type = 'message';
        body.user = message.from._serialized;

        if (message.type == "chat" && message.sender.id == intents.bot.masterId) {

            if (message.body == "send") {
                window.log("message here " + JSON.stringify(message));
                try {
                    WAPI.sendSeen(message.from);
                } catch (e) {
                    window.log("error sendSeen", e);
                    console.log("error sendSeen", e);
                }
                let recipients = intents.bot.recipients;
                let promise = Promise.resolve();
                recipients.reduce((previousPromise, curRecipient) => {
                    return previousPromise.then(() => new Promise((resolve) => {
                        if (previewData.url) {
                            WAPI.sendMessageWithThumb(previewData.thumb,
                                previewData.url, previewData.title, previewData.description, previewData.text, curRecipient);
                            console.log();
                        } else {
                            WAPI.sendMessage2(curRecipient, previewData.text);
                            console.log();
                        }
                        setTimeout(() => {
                            resolve(1)
                        }, INTERVAL);
                    }))
                }, Promise.resolve());
            }

            if (message.body == "echo") {
                WAPI.sendSeen(message.from);
                console.log();
                WAPI.sendMessage2(intents.bot.echo, "chat id is " + message.chat.id);
                console.log();
            }

            if (message.body == "listGroups") {
                let chats = WAPI.getAllChats();
                // filter out the groups
                chats = chats.filter(it => it.isGroup);
                window.log("chats1 " + JSON.stringify(chats));
                chats = chats.map(it => {
                    return {
                        name: it.name,
                        id: it.id
                    }
                })
                window.log("chats2 " + JSON.stringify(chats));
                WAPI.sendMessage2(intents.bot.echo, JSON.stringify(chats));
            }
        }
    }
});
WAPI.addOptions = function () {
    var suggestions = "";
    intents.smartreply.suggestions.map((item) => {
        suggestions += `<button style="background-color: #eeeeee;
                                margin: 5px;
                                padding: 5px 10px;
                                font-size: inherit;
                                border-radius: 50px;" class="reply-options">${item}</button>`;
    });
    var div = document.createElement("DIV");
    div.style.height = "40px";
    div.style.textAlign = "center";
    div.style.zIndex = "5";
    div.innerHTML = suggestions;
    div.classList.add("grGJn");
    var mainDiv = document.querySelector("#main");
    var footer = document.querySelector("footer");
    footer.insertBefore(div, footer.firstChild);
    var suggestions = document.body.querySelectorAll(".reply-options");
    for (let i = 0; i < suggestions.length; i++) {
        const suggestion = suggestions[i];
        suggestion.addEventListener("click", (event) => {
            console.log(event.target.textContent);
            window.sendMessage(event.target.textContent).then(text => console.log(text));
        });
    }
    mainDiv.children[mainDiv.children.length - 5].querySelector("div > div div[tabindex]").scrollTop += 100;
}