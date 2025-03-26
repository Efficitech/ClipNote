document.addEventListener("DOMContentLoaded", function () {
    const saveButton = document.getElementById("saveNote");
    const categoryInput = document.getElementById("category");
    const noteInput = document.getElementById("note");
    const notesList = document.getElementById("notesList");
    const clearAllButton = document.getElementById("clearAll");
    const exportButton = document.getElementById("exportNotes");
    const importInput = document.getElementById("importNotes");
    const importButton = document.getElementById("importNotesBtn");
    const restoreBackupButton = document.getElementById("restoreBackup");
    displayNotes()
    // Advanced Categorization
    const categories = [
        'Work', 'Personal', 'Research', 'Ideas', 'Quotes', 
        'Todo', 'Learning', 'Project', 'Inspiration'
    ];

    // Enhanced Summarization
    function intelligentSummarize(text) {
        if (!text || text.length < 50) return text;

        const stopwords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 
            'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 
            'into', 'over', 'is', 'are', 'was', 'were'
        ]);

        const sentences = text.match(/[^.!?]+[.!?]\s*/g) || [text];
        
        // Advanced scoring mechanism
        const sentenceScores = sentences.map(sentence => {
            const words = sentence.toLowerCase().match(/\b\w+\b/g) || [];
            const significantWords = words.filter(word => 
                word.length > 3 && !stopwords.has(word)
            );

            return {
                sentence: sentence.trim(),
                score: significantWords.length * sentence.length
            };
        });

        const topSentences = sentenceScores
            .sort((a, b) => b.score - a.score)
            .slice(0, 2)
            .map(item => item.sentence);

        return topSentences.length > 0 
            ? topSentences.join(" ") 
            : text.slice(0, 200);
    }

    // Smart Category Suggestion
    function suggestCategory(text) {
        const categoryRules = {
            'Work': ['project', 'meeting', 'deadline', 'work', 'client', 'task'],
            'Personal': ['family', 'health', 'hobby', 'friend', 'personal'],
            'Research': ['study', 'research', 'data', 'analysis', 'scientific'],
            'Ideas': ['idea', 'concept', 'innovation', 'create', 'design'],
            'Quotes': ['quote', 'said', 'wisdom', 'inspiration'],
            'Todo': ['todo', 'task', 'reminder', 'checklist', 'plan']
        };

        const lowerText = text.toLowerCase();
        
        const matchedCategory = Object.entries(categoryRules)
            .map(([category, keywords]) => ({
                category,
                score: keywords.filter(keyword => 
                    lowerText.includes(keyword)
                ).length
            }))
            .sort((a, b) => b.score - a.score)[0];

        return matchedCategory.score > 0 
            ? matchedCategory.category 
            : 'Uncategorized';
    }

    // Save note with enhanced features
    function saveNote(text, manualCategory = null) {
        const trimmedText = text.trim();
        if (!trimmedText) return;

        chrome.storage.local.get("notes", function (result) {
            let notes = result.notes || [];
            
            // Use manual category or suggest one
            const category = manualCategory || 
                suggestCategory(trimmedText) || 
                'Uncategorized';

            notes.push({ 
                text: trimmedText, 
                category: category,
                summary: intelligentSummarize(trimmedText),
                timestamp: Date.now(),
                id: Math.random().toString(36).substr(2, 9)
            });

            chrome.storage.local.set({ "notes": notes }, displayNotes);
        });
    }

    // Enhanced note display
    function displayNotes() {
        chrome.storage.local.get("notes", function (result) {
            notesList.innerHTML = "";
            let notes = result.notes || [];
            
            // Sort by most recent
            notes.sort((a, b) => b.timestamp - a.timestamp);

            notes.forEach((note, index) => {
                let listItem = document.createElement("li");
                listItem.innerHTML = `
                    <div class="note-header">
                        <span class="category-tag">${note.category}</span>
                        <span class="timestamp">
                            ${new Date(note.timestamp).toLocaleString()}
                        </span>
                    </div>
                    <div class="note-content">
                        <p class="note-text">${note.text}</p>
                        <div class="note-summary">
                            <strong>Summary:</strong> ${note.summary}
                        </div>
                    </div>
                    <div class="note-actions">
                        <button class="edit-btn" data-index="${index}">✏️ Edit</button>
                        <button class="delete-btn" data-index="${index}">🗑️ Delete</button>
                    </div>
                `;
                notesList.appendChild(listItem);
            });

            // Event listeners for edit and delete
            document.querySelectorAll('.edit-btn').forEach(button => {
                button.addEventListener('click', function() {
                    let index = this.getAttribute('data-index');
                    editNote(index);
                });
            });

            document.querySelectorAll('.delete-btn').forEach(button => {
                button.addEventListener('click', function() {
                    let index = this.getAttribute('data-index');
                    deleteNote(index);
                });
            });
        });
    }

    // Edit note with category preservation
    function editNote(index) {
        chrome.storage.local.get("notes", function (result) {
            let notes = result.notes || [];
            let note = notes[index];
            
            let newText = prompt("Edit your note:", note.text);
            
            if (newText !== null) {
                notes[index].text = newText;
                notes[index].summary = intelligentSummarize(newText);
                
                chrome.storage.local.set({ "notes": notes }, displayNotes);
            }
        });
    }

    // Delete specific note
    function deleteNote(index) {
        chrome.storage.local.get("notes", function (result) {
            let notes = result.notes || [];
            notes.splice(index, 1);
            chrome.storage.local.set({ "notes": notes }, displayNotes);
        });
    }

    // Event Listeners
    saveButton.addEventListener("click", function () {
        let noteText = noteInput.value.trim();
        let category = categoryInput.value.trim();

        if (noteText) {
            saveNote(noteText, category);
            noteInput.value = '';
            categoryInput.value = '';
        }
    });

    clearAllButton.addEventListener("click", function () {
        if (confirm("Are you sure you want to delete all notes?")) {
            chrome.storage.local.set({ "notes": [] }, displayNotes);
        }
    });

    // Export functionality
    exportButton.addEventListener("click", function() {
        noteSyncManager.exportNotes()
            .then(result => {
                alert(`Exported ${result.notesCount} notes successfully!`);
            })
            .catch(error => {
                alert('Export failed: ' + error.message);
            });
    });

    // Import functionality
    importButton.addEventListener("click", () => {
        importInput.click();
    });

    importInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const result = await noteSyncManager.importNotes(file);
                alert(`Imported ${result.importedCount} notes. Total notes now: ${result.totalNotes}`);
                displayNotes();
            } catch (error) {
                alert('Import failed: ' + error.message);
            }
        }
    });

    // Restore from backup
    restoreBackupButton.addEventListener("click", async () => {
        chrome.storage.local.get(['noteBackups'], async (result) => {
            const backups = result.noteBackups || [];
            
            if (backups.length === 0) {
                alert('No backups available');
                return;
            }

            const backupChoice = prompt(
                `Select backup to restore (0-${backups.length - 1}). ` +
                'Backups are ordered from most recent to oldest.'
            );

            const backupIndex = parseInt(backupChoice);

            if (!isNaN(backupIndex)) {
                try {
                    const restoreResult = await noteSyncManager.restoreFromBackup(backupIndex);
                    alert(`Restored ${restoreResult.restoredNotesCount} notes from backup.`);
                    displayNotes();
                } catch (error) {
                    alert('Restore failed: ' + error.message);
                }
            }
        });
    });

    // Initial display
    displayNotes();
});