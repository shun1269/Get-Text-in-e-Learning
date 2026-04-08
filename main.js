(function () {
    const INSTANCE_KEY = "__speechExtractorInstance";
    if (window[INSTANCE_KEY] && typeof window[INSTANCE_KEY].cleanup === "function") {
        window[INSTANCE_KEY].cleanup();
    }

    console.log("抽出すたーと", "color: #ff8c00; font-weight: bold;");

    const targetNode = document.body;
    const lastTexts = new Set();
    let delayedTimer = null;
    let rafScheduled = false;
    const SHARED_KEY = "speechExtractorSeenKeys";

    function normalizeText(text) {
        return (text || "")
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function getCurrentPageLabel() {
        const candidates = document.querySelectorAll(".textAreaText");
        for (const el of candidates) {
            const t = normalizeText(el.textContent || "");
            if (/^\d+(\s*\/\s*\d+)?$/.test(t)) return t;
        }
        return "unknown";
    }

    function getSharedSeenMap() {
        try {
            const raw = document.documentElement.dataset[SHARED_KEY] || "{}";
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") return parsed;
        } catch (_) {
            // ignore parse failure and recreate map
        }
        return {};
    }

    function setSharedSeenMap(map) {
        document.documentElement.dataset[SHARED_KEY] = JSON.stringify(map);
    }

    function isAlreadyEmitted(signature) {
        const map = getSharedSeenMap();
        return Boolean(map[signature]);
    }

    function markEmitted(signature) {
        const map = getSharedSeenMap();
        map[signature] = Date.now();

        const entries = Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 120);
        setSharedSeenMap(Object.fromEntries(entries));
    }

    function extractSpeech() {
        const allElements = document.querySelectorAll(".textAreaText");
        const currentPage = getCurrentPageLabel();

        allElements.forEach((el) => {
            const currentText = normalizeText(el.innerText);
            const textContainer = el.closest(".text");
            const caseContainer = el.closest(".textArea.Case");
            const parentClass = textContainer ? textContainer.className : "";

            // 吹き出しは .textArea.Case 配下の .text.textN 系だけを対象にする。
            const isSpeechBubble = Boolean(caseContainer)
                && /(?:^|\s)text(?:\s|$)/.test(parentClass)
                && /(?:^|\s)text\d+(?:\s|$)/.test(parentClass);

            // 1/42, 1 / 42, １／４２ などページ番号形式を除外。
            const isNumberOnly = /^[\d０-９]+(?:\s*[\/／]\s*[\d０-９]+)?$/.test(currentText);

            const signature = currentPage + "::" + currentText;

            if (
                currentText
                && isSpeechBubble
                && !isNumberOnly
                && !lastTexts.has(currentText)
                && !isAlreadyEmitted(signature)
            ) {
                console.log(
                    "%c[セリフ]: %c" + currentText,
                    "color: #007bff; font-weight: bold; font-size: 14px;",
                    "color: #ffffff; background: #333; padding: 2px 5px; border-radius: 3px;"
                );

                lastTexts.add(currentText);
                markEmitted(signature);
                if (lastTexts.size > 20) {
                    const firstItem = lastTexts.values().next().value;
                    lastTexts.delete(firstItem);
                }
            }
        });
    }

    function scheduleExtractNextFrame() {
        if (rafScheduled) return;
        rafScheduled = true;
        requestAnimationFrame(() => {
            rafScheduled = false;
            extractSpeech();
        });
    }

    const observer = new MutationObserver(() => {
        scheduleExtractNextFrame();

        // ページ送り直後にDOM反映が遅れる場合の再抽出
        clearTimeout(delayedTimer);
        delayedTimer = window.setTimeout(scheduleExtractNextFrame, 220);
    });

    const config = { childList: true, subtree: true, characterData: true, attributes: true };
    observer.observe(targetNode, config);

    // 初期表示分
    extractSpeech();

    // 再実行時に二重監視にならないように後始末関数を保持
    window[INSTANCE_KEY] = {
        cleanup() {
            observer.disconnect();
            clearTimeout(delayedTimer);
        },
    };
})();