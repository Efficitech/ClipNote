document.addEventListener("DOMContentLoaded", function () {
    const saveButton = document.getElementById("saveNote");
    const categoryInput = document.getElementById("category");
    const notesList = document.getElementById("notesList");

    function getHighlightedText(callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.scripting.executeScript(
                {
                    target: { tabId: tabs[0].id },
                    function: () => window.getSelection().toString().trim(),
                },
                (results) => callback(results?.[0]?.result || null)
            );
        });
    }

    saveButton.addEventListener("click", () => {
        getHighlightedText((highlightedText) => {
            if (highlightedText) {
                const category = categoryInput.value.trim() || "Uncategorized";
                const note = { text: highlightedText, category };
                chrome.storage.local.get("notes", (result) => {
                    const notes = result.notes || [];
                    notes.push(note);
                    chrome.storage.local.set({ notes }, displayNotes);
                });
            }
        });
    });

    function displayNotes() {
        chrome.storage.local.get("notes", (result) => {
            notesList.innerHTML = "";
            const notes = result.notes || [];
            notes.forEach((note, index) => {
                const listItem = document.createElement("li");
                listItem.innerHTML = `
                    <div class="noteHeader">
                        <button class="toggleNote" data-index="${index}">▶️</button>
                        <span class="noteCategory">${note.category}</span>
                    </div>
                    <div class="noteContent" id="noteContent-${index}" style="display: none;">
                        <p class="noteText">${note.text}</p>
                        <button class="editNote" data-index="${index}">✏️</button>
                        <button class="deleteNote" data-index="${index}">🗑️</button>
                        <button class="summarizeNote" data-index="${index}">🔍 Summarize</button>
                        <p class="summaryOutput" id="summary-${index}" style="display: none;"></p>
                    </div>
                `;
                notesList.appendChild(listItem);
            });

            document.querySelectorAll(".toggleNote").forEach(button => {
                button.addEventListener("click", function () {
                    const index = this.dataset.index;
                    const content = document.getElementById(`noteContent-${index}`);
                    content.style.display = content.style.display === "none" ? "block" : "none";
                    this.textContent = content.style.display === "none" ? "▶️" : "🔽";
                });
            });

            document.querySelectorAll(".deleteNote").forEach(button => {
                button.addEventListener("click", function () {
                    deleteNote(this.dataset.index);
                });
            });

            document.querySelectorAll(".editNote").forEach(button => {
                button.addEventListener("click", function () {
                    editNote(this.dataset.index);
                });
            });

            document.querySelectorAll(".summarizeNote").forEach(button => {
                button.addEventListener("click", function () {
                    summarizeNote(this.dataset.index);
                });
            });
        });
    }

    function deleteNote(index) {
        chrome.storage.local.get("notes", (result) => {
            const notes = result.notes || [];
            notes.splice(index, 1);
            chrome.storage.local.set({ notes }, displayNotes);
        });
    }

    function editNote(index) {
        chrome.storage.local.get("notes", (result) => {
            const notes = result.notes || [];
            const newText = prompt("Edit your note:", notes[index].text);
            if (newText) {
                notes[index].text = newText;
                chrome.storage.local.set({ notes }, displayNotes);
            }
        });
    }

    function summarizeNote(index) {
        chrome.storage.local.get("notes", (result) => {
            const notes = result.notes || [];
            const summary = generateSummary(notes[index].text);
            const summaryElement = document.getElementById(`summary-${index}`);
            summaryElement.textContent = summary;
            summaryElement.style.display = "block";
        });
    }

    function generateSummary(text) {
        if (!text) return "No notes available.";

        // Preprocess the text (cleaning, removing stopwords, etc.)
        const words = preprocessText(text);

        // Score sentences based on importance (using NLP or advanced techniques)
        const scoredSentences = scoreSentences(words, text);

        // Sort sentences by score and take the top N sentences (e.g., top 3)
        const topSentences = getTopSentences(scoredSentences);

        // Filter out redundancy and provide a coherent summary
        const summary = removeRedundantSentences(topSentences);

        return summary.join(" ") || "No important points found.";
    }

    function preprocessText(text) {
        // Clean and tokenize text, remove stopwords, etc.
        return text.toLowerCase().match(/\b\w{4,}\b/g) || [];
    }

    function scoreSentences(words, text) {
        // Use NLP techniques to assign importance to each sentence
        // For example, using TF-IDF or sentence embeddings
        const sentences = text.match(/[^.!?]+[.!?]/g) || [text];
        return sentences.map(sentence => {
            const score = sentence.match(/\b\w{4,}\b/g).reduce((acc, word) => acc + (words[word] || 0), 0);
            return { sentence, score };
        });
    }

    function getTopSentences(scoredSentences) {
        return scoredSentences.sort((a, b) => b.score - a.score).slice(0, 3).map(s => s.sentence);
    }

    function removeRedundantSentences(sentences) {
        // Use more advanced redundancy detection like cosine similarity or Jaccard similarity
        return sentences.filter((sentence, index, arr) => {
            return !arr.some((otherSentence, i) => i !== index && isRedundant(sentence, otherSentence));
        });
    }

    function isRedundant(sentence1, sentence2) {
        // Compare sentences based on semantic similarity (cosine similarity or Jaccard)
        return cosineSimilarity(sentence1, sentence2) > 0.8;
    }

    function cosineSimilarity(str1, str2) {
        const words1 = str1.toLowerCase().match(/\b\w{4,}\b/g) || [];
        const words2 = str2.toLowerCase().match(/\b\w{4,}\b/g) || [];
        const allWords = [...new Set([...words1, ...words2])];
        const vec1 = allWords.map(word => words1.includes(word) ? 1 : 0);
        const vec2 = allWords.map(word => words2.includes(word) ? 1 : 0);

        const dotProduct = vec1.reduce((sum, v, i) => sum + v * vec2[i], 0);
        const magnitude1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
        const magnitude2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));
        return dotProduct / (magnitude1 * magnitude2);
    }

    displayNotes();
});
