document.addEventListener("DOMContentLoaded", function () {
    let saveButton = document.getElementById("saveNote");
    let categoryInput = document.getElementById("category");
    let notesList = document.getElementById("notesList");

    // Fetch the highlighted text from the active tab
    function getHighlightedText(callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.scripting.executeScript(
                {
                    target: { tabId: tabs[0].id },
                    function: () => window.getSelection().toString().trim()
                },
                (results) => {
                    if (results && results[0].result) {
                        callback(results[0].result);
                    } else {
                        callback(null);
                    }
                }
            );
        });
    }

    // Save the highlighted text as a note
    saveButton.addEventListener("click", function () {
        if (document.getElementById('note').value !== '') {
            let category = categoryInput.value.trim();
            let note = { text: document.getElementById('note').value, category: category || "Uncategorized" };

            chrome.storage.local.get("notes", function (result) {
                let notes = result.notes || [];
                notes.push(note);
                chrome.storage.local.set({ "notes": notes }, displayNotes);
            });
        } else {
            getHighlightedText(function (highlightedText) {
                if (highlightedText) {
                    let category = categoryInput.value.trim();
                    let note = { text: highlightedText, category: category || "Uncategorized" };

                    chrome.storage.local.get("notes", function (result) {
                        let notes = result.notes || [];
                        notes.push(note);
                        chrome.storage.local.set({ "notes": notes }, displayNotes);
                    });
                }
            });
        }
    });

    // Display saved notes with individual summarization and toggle buttons
    function displayNotes() {
        chrome.storage.local.get("notes", function (result) {
            notesList.innerHTML = "";
            let notes = result.notes || [];

            notes.forEach((note, index) => {
                let listItem = document.createElement("li");
                listItem.innerHTML = `
                    <div class="noteHeader">
                        <button class="toggleNote" data-index="${index}">🔽</button> 
                        <span class="noteCategory">${note.category}</span>
                    </div>
                    <div class="noteContent" id="noteContent-${index}" style="display: block;">
                        <p><span class="noteText">${note.text}</span></p>
                        <button class="editNote" data-index="${index}">✏️</button>
                        <button class="deleteNote" data-index="${index}">🗑️</button>
                        <button class="summarizeNote" data-index="${index}">🔍 Summarize</button>
                        <p class="summaryOutput" id="summary-${index}" style="display: none;"></p>
                    </div>
                `;
                notesList.appendChild(listItem);
            });

            // Add event listeners for toggle buttons
            document.querySelectorAll(".toggleNote").forEach(button => {
                button.addEventListener("click", function () {
                    let index = this.getAttribute("data-index");
                    let content = document.getElementById(`noteContent-${index}`);
                    if (content.style.display === "none") {
                        content.style.display = "block";
                        content.style.maxHeight = content.scrollHeight + "px";
                        this.textContent = "🔽";
                    } else {
                        content.style.maxHeight = "0";
                        setTimeout(() => (content.style.display = "none"), 300);
                        this.textContent = "▶️";
                    }
                });
            });

            // Add event listeners for delete and edit buttons
            document.querySelectorAll(".deleteNote").forEach(button => {
                button.addEventListener("click", function () {
                    deleteNote(this.getAttribute("data-index"));
                });
            });

            document.querySelectorAll(".editNote").forEach(button => {
                button.addEventListener("click", function () {
                    editNote(this.getAttribute("data-index"));
                });
            });

            // Add event listeners for individual summarization
            document.querySelectorAll(".summarizeNote").forEach(button => {
                button.addEventListener("click", function () {
                    let index = this.getAttribute("data-index");
                    chrome.storage.local.get("notes", function (result) {
                        let notes = result.notes || [];
                        let summary = generateAdvancedSummary(notes[index].text);
                        let summaryElement = document.getElementById(`summary-${index}`);
                        summaryElement.textContent = summary || "No important points found.";
                        summaryElement.style.display = "block"; // Show summary
                    });
                });
            });
        });
    }

    // Delete a note
    function deleteNote(index) {
        chrome.storage.local.get("notes", function (result) {
            let notes = result.notes || [];
            notes.splice(index, 1);
            chrome.storage.local.set({ "notes": notes }, displayNotes);
        });
    }

    // Edit a note
    function editNote(index) {
        chrome.storage.local.get("notes", function (result) {
            let notes = result.notes || [];
            let note = notes[index];
            let noteTextElement = document.querySelector(`#noteContent-${index} .noteText`);

            // Make note content editable
            noteTextElement.setAttribute("contenteditable", "true");
            noteTextElement.focus();

            // Add a save button inside the note content
            let saveButton = document.createElement("button");
            saveButton.textContent = "Save";
            saveButton.classList.add("saveNote");
            document.body.appendChild(saveButton);

            // Handle save button click
            saveButton.addEventListener("click", function () {
                let newText = noteTextElement.textContent.trim();

                if (newText && newText !== note.text) {
                    note.text = newText; // Update the note text
                    chrome.storage.local.set({ "notes": notes }, displayNotes);
                }

                // Disable editing and remove save button
                noteTextElement.removeAttribute("contenteditable");
                saveButton.remove();
            });
        });
    }

    // Advanced Summarization with TF-IDF
    function generateAdvancedSummary(text) {
        if (!text) return "No notes available.";

        let sentences = text.match(/[^.!?]+[.!?]/g) || [text]; // Split into sentences
        let words = text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/);

        let wordFreq = {};
        words.forEach(word => {
            if (word.length > 3) wordFreq[word] = (wordFreq[word] || 0) + 1;
        });

        let docFreq = {};
        sentences.forEach(sentence => {
            let uniqueWords = new Set(sentence.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/));
            uniqueWords.forEach(word => {
                if (word.length > 3) docFreq[word] = (docFreq[word] || 0) + 1;
            });
        });

        let tfidf = {};
        words.forEach(word => {
            if (word.length > 3) {
                let tf = wordFreq[word] / words.length;
                let idf = Math.log(sentences.length / (1 + (docFreq[word] || 0)));
                tfidf[word] = tf * idf;
            }
        });

        let sentenceScores = sentences.map(sentence => {
            let score = 0;
            let wordsInSentence = sentence.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/);
            wordsInSentence.forEach(word => {
                if (tfidf[word]) score += tfidf[word];
            });
            return { sentence, score };
        });

        sentenceScores.sort((a, b) => b.score - a.score);
        let topSentences = sentenceScores.slice(0, Math.min(3, sentenceScores.length)).map(s => s.sentence);

        return topSentences.join(" ");
    }

    displayNotes();
});
