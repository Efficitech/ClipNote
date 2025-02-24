document.addEventListener("DOMContentLoaded", function () {
    let saveButton = document.getElementById("saveNote");
    let categoryInput = document.getElementById("category");
    let notesList = document.getElementById("notesList");
    let clearAllButton = document.getElementById("clearAll");

    // Ensure the "Clear All" button is only assigned once
    clearAllButton.addEventListener("click", function () {
        chrome.storage.local.set({ "notes": [] }, displayNotes);
    });

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
        let noteInput = document.getElementById("note").value.trim();
        let category = categoryInput.value.trim() || "Uncategorized";

        if (noteInput !== "") {
            saveNote(noteInput, category);
        } else {
            getHighlightedText(function (highlightedText) {
                if (highlightedText) saveNote(highlightedText, category);
            });
        }
    });

    function saveNote(text, category) {
        chrome.storage.local.get("notes", function (result) {
            let notes = result.notes || [];
            notes.push({ text, category });
            chrome.storage.local.set({ "notes": notes }, displayNotes);
        });
    }

    // Display saved notes with individual summarization and toggle buttons
    function displayNotes() {
        chrome.storage.local.get("notes", function (result) {
            notesList.innerHTML = "";
            let notes = result.notes || [];

            notes.forEach((note, index) => {
                let listItem = document.createElement("li");
                listItem.setAttribute("draggable", "true"); // Make the list item draggable
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

            enableDragAndDrop();
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
    
        // Improved sentence splitting (handles abbreviations, quotes, etc.)
        let sentences = text.match(/[^.!?]+[.!?]\s*/g) || [text];
    
        // Remove stopwords and stem words
        let stopwords = new Set(["the", "is", "and", "of", "in", "it", "to", "that", "this", "with", "for", "on", "at", "by", "an", "as", "be", "are", "was", "were", "has", "have", "had", "but", "not", "or", "which", "what", "you", "he", "she", "we", "they", "your", "their", "his", "her", "our", "my", "me", "him", "us", "them", "its", "who", "whom", "whose", "where", "when", "why", "how", "if", "then", "else", "while", "because", "so", "than", "just", "also", "very", "too", "only", "even", "such", "about", "from", "into", "over", "under", "again", "further", "once", "here", "there", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now"]);
    
        let words = text
            .toLowerCase()
            .replace(/[^\w\s]/g, "")
            .split(/\s+/)
            .filter(word => word.length > 3 && !stopwords.has(word));
    
        // Calculate word frequency
        let wordFreq = {};
        words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        });
    
        // Calculate document frequency
        let docFreq = {};
        sentences.forEach(sentence => {
            let uniqueWords = new Set(
                sentence
                    .toLowerCase()
                    .replace(/[^\w\s]/g, "")
                    .split(/\s+/)
                    .filter(word => word.length > 3 && !stopwords.has(word))
            );
            uniqueWords.forEach(word => {
                docFreq[word] = (docFreq[word] || 0) + 1;
            });
        });
    
        // Calculate TF-IDF scores
        let tfidf = {};
        words.forEach(word => {
            let tf = wordFreq[word] / words.length;
            let idf = Math.log(sentences.length / (1 + (docFreq[word] || 0)));
            tfidf[word] = tf * idf;
        });
    
        // Score sentences based on TF-IDF
        let sentenceScores = sentences.map(sentence => {
            let score = 0;
            let wordsInSentence = sentence
                .toLowerCase()
                .replace(/[^\w\s]/g, "")
                .split(/\s+/)
                .filter(word => word.length > 3 && !stopwords.has(word));
            wordsInSentence.forEach(word => {
                if (tfidf[word]) score += tfidf[word];
            });
            return { sentence, score };
        });
    
        // Sort sentences by score and select top 3 (or fewer)
        sentenceScores.sort((a, b) => b.score - a.score);
        let topSentences = sentenceScores
            .slice(0, Math.min(3, sentenceScores.length))
            .map(s => s.sentence);
    
        return topSentences.join(" ");
    }

    // Drag-and-drop functionality
    function enableDragAndDrop() {
        let draggedItem = null;

        notesList.addEventListener("dragstart", function (event) {
            draggedItem = event.target;
            event.target.classList.add("dragging");
        });

        notesList.addEventListener("dragover", function (event) {
            event.preventDefault();
            let afterElement = getDragAfterElement(notesList, event.clientY);
            if (afterElement == null) {
                notesList.appendChild(draggedItem);
            } else {
                notesList.insertBefore(draggedItem, afterElement);
            }
        });

        notesList.addEventListener("dragend", function () {
            draggedItem.classList.remove("dragging");
            updateNoteOrder();
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll("li:not(.dragging)")];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function updateNoteOrder() {
        let newOrder = [...notesList.children].map(item => ({
            text: item.querySelector(".noteText").textContent,
            category: item.querySelector(".noteCategory").textContent
        }));

        chrome.storage.local.set({ "notes": newOrder }, displayNotes);
    }

    displayNotes();
});