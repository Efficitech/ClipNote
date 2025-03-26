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

    // Language list for translation
    const languageCodes = {
        'English': 'en',
        'Spanish': 'es',
        'French': 'fr',
        'German': 'de',
        'Italian': 'it',
        'Portuguese': 'pt',
        'Russian': 'ru',
        'Chinese': 'zh',
        'Japanese': 'ja',
        'Korean': 'ko',
        'Arabic': 'ar'
    };

    displayNotes();

	 chrome.storage.local.get("highlightedText", function(result) {
        if (result.highlightedText) {
            noteInput.value = result.highlightedText;
            // Optional: Clear the stored text after loading
            chrome.storage.local.remove("highlightedText");
        }
    });

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

    // Translation Function
    function translateText(text, sourceLang, targetLang) {
        return new Promise((resolve, reject) => {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            
            fetch(url)
                .then(response => response.json())
                .then(data => {
                    // Extract translated text from the response
                    const translatedText = data[0][0][0];
                    resolve(translatedText);
                })
                .catch(error => {
                    console.error('Translation error:', error);
                    reject(error);
                });
        });
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
                        <button class="translate-btn" data-index="${index}">🌐 Translate</button>
                    </div>
                    <div class="translation-container" style="display:none;">
                        <select class="source-lang">
                            ${Object.entries(languageCodes).map(([name, code]) => 
                                `<option value="${code}">${name}</option>`
                            ).join('')}
                        </select>
                        <select class="target-lang">
                            ${Object.entries(languageCodes).map(([name, code]) => 
                                `<option value="${code}">${name}</option>`
                            ).join('')}
                        </select>
                        <button class="do-translate-btn">Translate</button>
                        <div class="translated-text"></div>
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

            // New translation event listeners
            document.querySelectorAll('.translate-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const translationContainer = this.closest('li').querySelector('.translation-container');
                    translationContainer.style.display = 
                        translationContainer.style.display === 'none' ? 'block' : 'none';
                });
            });

            document.querySelectorAll('.do-translate-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const container = this.closest('.translation-container');
                    const sourceLangSelect = container.querySelector('.source-lang');
                    const targetLangSelect = container.querySelector('.target-lang');
                    const translatedTextDiv = container.querySelector('.translated-text');
                    const noteText = this.closest('li').querySelector('.note-text').textContent;

                    const sourceLang = sourceLangSelect.value;
                    const targetLang = targetLangSelect.value;

                    translateText(noteText, sourceLang, targetLang)
                        .then(translatedText => {
                            translatedTextDiv.textContent = translatedText;
                        })
                        .catch(error => {
                            translatedTextDiv.textContent = 'Translation failed';
                        });
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

    // Export functionality
    function exportNotes() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get("notes", function (result) {
                const notes = result.notes || [];
                const blob = new Blob([JSON.stringify(notes, null, 2)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `notes_backup_${new Date().toISOString().replace(/:/g, '-')}.json`;
                a.click();
                
                URL.revokeObjectURL(url);
                resolve({ notesCount: notes.length });
            });
        });
    }

    // Import functionality
    function importNotes(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedNotes = JSON.parse(e.target.result);
                    
                    chrome.storage.local.get("notes", function (result) {
                        let existingNotes = result.notes || [];
                        const newNotes = [...existingNotes, ...importedNotes];
                        
                        chrome.storage.local.set({ "notes": newNotes }, () => {
                            resolve({
                                importedCount: importedNotes.length,
                                totalNotes: newNotes.length
                            });
                        });
                    });
                } catch (error) {
                    reject(new Error('Invalid JSON file'));
                }
            };
            reader.readAsText(file);
        });
    }

    // Backup functionality
    function createBackup() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get("notes", function (result) {
                const notes = result.notes || [];
                
                chrome.storage.local.get(['noteBackups'], function(backupResult) {
                    const backups = backupResult.noteBackups || [];
                    
                    // Add current notes as a new backup
                    backups.unshift({
                        timestamp: Date.now(),
                        notes: notes
                    });
                    
                    // Keep only last 5 backups
                    const limitedBackups = backups.slice(0, 5);
                    
                    chrome.storage.local.set({ 'noteBackups': limitedBackups }, () => {
                        resolve({ backupCount: limitedBackups.length });
                    });
                });
            });
        });
    }

    // Restore from backup
    function restoreFromBackup(backupIndex) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['noteBackups'], function(result) {
                const backups = result.noteBackups || [];
                
                if (backupIndex < 0 || backupIndex >= backups.length) {
                    reject(new Error('Invalid backup index'));
                    return;
                }
                
                const selectedBackup = backups[backupIndex];
                
                chrome.storage.local.set({ "notes": selectedBackup.notes }, () => {
                    resolve({ 
                        restoredNotesCount: selectedBackup.notes.length 
                    });
                });
            });
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
        exportNotes()
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
                const result = await importNotes(file);
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
                    const restoreResult = await restoreFromBackup(backupIndex);
                    alert(`Restored ${restoreResult.restoredNotesCount} notes from backup.`);
                    displayNotes();
                } catch (error) {
                    alert('Restore failed: ' + error.message);
                }
            }
        });
    });

    // Initial display
});