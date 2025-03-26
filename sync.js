class NoteSyncManager {
    constructor() {
        this.MAX_BACKUPS = 5;
    }

    // Enhanced export with multiple formats and backup management
    async exportNotes(format = 'json') {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['notes'], (result) => {
                const notes = result.notes || [];
                
                // Multiple export format support
                let exportData, fileType, fileName;
                switch(format) {
                    case 'csv':
                        exportData = this._convertToCSV(notes);
                        fileType = 'text/csv';
                        fileName = `clipnote_export_${this._getTimestamp()}.csv`;
                        break;
                    case 'txt':
                        exportData = this._convertToPlainText(notes);
                        fileType = 'text/plain';
                        fileName = `clipnote_export_${this._getTimestamp()}.txt`;
                        break;
                    default: // JSON
                        exportData = JSON.stringify(notes, null, 2);
                        fileType = 'application/json';
                        fileName = `clipnote_export_${this._getTimestamp()}.json`;
                }

                // Create backup in local storage
                this._manageBackups(notes);

                const blob = new Blob([exportData], {type: fileType});
                const url = URL.createObjectURL(blob);
                
                chrome.downloads.download({
                    url: url,
                    filename: fileName,
                    saveAs: true
                }, (downloadId) => {
                    resolve({
                        downloadId,
                        notesCount: notes.length,
                        format
                    });
                });
            });
        });
    }

    // Import notes with format detection and validation
    async importNotes(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    let importedNotes;
                    const content = event.target.result;
                    const fileExtension = file.name.split('.').pop().toLowerCase();

                    switch(fileExtension) {
                        case 'json':
                            importedNotes = JSON.parse(content);
                            break;
                        case 'csv':
                            importedNotes = this._parseCSV(content);
                            break;
                        case 'txt':
                            importedNotes = this._parsePlainText(content);
                            break;
                        default:
                            throw new Error('Unsupported file format');
                    }

                    // Validation
                    if (!Array.isArray(importedNotes)) {
                        throw new Error('Invalid notes structure');
                    }

                    // Merge and deduplicate
                    chrome.storage.local.get(['notes'], (result) => {
                        const existingNotes = result.notes || [];
                        const mergedNotes = this._mergeAndDeduplicate(existingNotes, importedNotes);
                        
                        chrome.storage.local.set({ 'notes': mergedNotes }, () => {
                            resolve({
                                importedCount: importedNotes.length,
                                totalNotes: mergedNotes.length
                            });
                        });
                    });
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsText(file);
        });
    }

    // Local backup management
    async _manageBackups(notes) {
        chrome.storage.local.get(['noteBackups'], (result) => {
            let backups = result.noteBackups || [];
            
            // Add new backup
            backups.unshift({
                timestamp: Date.now(),
                notes: notes
            });

            // Trim to max backups
            if (backups.length > this.MAX_BACKUPS) {
                backups = backups.slice(0, this.MAX_BACKUPS);
            }

            chrome.storage.local.set({ 'noteBackups': backups });
        });
    }

    // Utility methods for conversion
    _convertToCSV(notes) {
        const headers = ['Category', 'Text', 'Timestamp', 'Summary'];
        const csvRows = notes.map(note => 
            [note.category, note.text, note.timestamp, note.summary]
                .map(field => `"${field.replace(/"/g, '""')}"`)
                .join(',')
        );
        return [headers.join(','), ...csvRows].join('\n');
    }

    _convertToPlainText(notes) {
        return notes.map(note => 
            `Category: ${note.category}\n` +
            `Text: ${note.text}\n` +
            `Timestamp: ${new Date(note.timestamp).toLocaleString()}\n` +
            `Summary: ${note.summary}\n\n---\n\n`
        ).join('');
    }

    _parseCSV(content) {
        const lines = content.split('\n');
        const headers = lines[0].split(',');
        return lines.slice(1).map(line => {
            const values = line.split(',').map(val => val.replace(/^"|"$/g, ''));
            return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
        });
    }

    _parsePlainText(content) {
        const notes = [];
        const noteBlocks = content.split('---\n').filter(block => block.trim());
        
        noteBlocks.forEach(block => {
            const note = {};
            block.split('\n').forEach(line => {
                const [key, ...value] = line.split(': ');
                if (key && value) {
                    note[key.toLowerCase()] = value.join(': ');
                }
            });
            notes.push(note);
        });

        return notes;
    }

    _mergeAndDeduplicate(existingNotes, newNotes) {
        const combinedNotes = [...existingNotes, ...newNotes];
        return combinedNotes.filter((note, index, self) => 
            index === self.findIndex(n => 
                n.text === note.text && 
                n.category === note.category
            )
        );
    }

    _getTimestamp() {
        return new Date().toISOString().replace(/[:.]/g, '-');
    }

    // Restore from local backups
    async restoreFromBackup(backupIndex) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['noteBackups'], (result) => {
                const backups = result.noteBackups || [];
                
                if (backupIndex >= 0 && backupIndex < backups.length) {
                    const selectedBackup = backups[backupIndex];
                    
                    chrome.storage.local.set({ 
                        'notes': selectedBackup.notes 
                    }, () => {
                        resolve({
                            restoredNotesCount: selectedBackup.notes.length,
                            backupTimestamp: selectedBackup.timestamp
                        });
                    });
                } else {
                    reject(new Error('Invalid backup index'));
                }
            });
        });
    }
}

const noteSyncManager = new NoteSyncManager();