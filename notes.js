document.addEventListener("DOMContentLoaded", function () {
    let allNotesList = document.getElementById("allNotesList");
    let clearAllButton = document.getElementById("clearAll");

    function displayAllNotes() {
        chrome.storage.local.get("notes", function (result) {
            allNotesList.innerHTML = "";
            let notes = result.notes || [];
            notes.forEach((note, index) => {
                let listItem = document.createElement("li");
                listItem.innerHTML = `
                    <strong>[${note.category}]</strong> ${note.text}
                    <button class="editNote" data-index="${index}">✏️</button>
                    <button class="deleteNote" data-index="${index}">🗑️</button>
                `;
                allNotesList.appendChild(listItem);
            });

            // Add event listeners for edit and delete
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
        });
    }

    // Delete a note
    function deleteNote(index) {
        chrome.storage.local.get("notes", function (result) {
            let notes = result.notes || [];
            notes.splice(index, 1);
            chrome.storage.local.set({ "notes": notes }, displayAllNotes);
        });
    }

    // Edit a note
    function editNote(index) {
        chrome.storage.local.get("notes", function (result) {
            let notes = result.notes || [];
            let newText = prompt("Edit your note:", notes[index].text);
            if (newText) {
                notes[index].text = newText;
                chrome.storage.local.set({ "notes": notes }, displayAllNotes);
            }
        });
    }

    // Clear all notes
    clearAllButton.addEventListener("click", function () {
        if (confirm("Are you sure you want to delete all notes?")) {
            chrome.storage.local.set({ "notes": [] }, displayAllNotes);
        }
    });

    displayAllNotes();
});
