document.addEventListener("DOMContentLoaded", function () {
    let saveButton = document.getElementById("saveNote");
    let categoryInput = document.getElementById("category");
    let notesList = document.getElementById("notesList");
    let clearAllButton = document.getElementById("clearAll");

    // Ensure the "Clear All" button is only assigned once
    clearAllButton.addEventListener("click", function () {
        chrome.storage.local.set({ "notes": [] }, displayNotes);
    });

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
                    </div>
                `;
                notesList.appendChild(listItem);
            });

            // Add event listeners
            document.querySelectorAll(".toggleNote").forEach(button => {
                button.addEventListener("click", function () {
                    let index = this.getAttribute("data-index");
                    let content = document.getElementById(`noteContent-${index}`);
                    content.style.display = content.style.display === "none" ? "block" : "none";
                });
            });

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

            enableDragAndDrop();
        });
    }

    function deleteNote(index) {
        chrome.storage.local.get("notes", function (result) {
            let notes = result.notes || [];
            notes.splice(index, 1);
            chrome.storage.local.set({ "notes": notes }, displayNotes);
        });
    }

    function editNote(index) {
        chrome.storage.local.get("notes", function (result) {
            let notes = result.notes || [];
            let noteTextElement = document.querySelector(`#noteContent-${index} .noteText`);

            noteTextElement.setAttribute("contenteditable", "true");
            noteTextElement.focus();

            let saveButton = document.createElement("button");
            saveButton.textContent = "Save";
            saveButton.classList.add("saveNote");
            document.body.appendChild(saveButton);

            saveButton.addEventListener("click", function () {
                let newText = noteTextElement.textContent.trim();
                if (newText && newText !== notes[index].text) {
                    notes[index].text = newText;
                    chrome.storage.local.set({ "notes": notes }, displayNotes);
                }
                noteTextElement.removeAttribute("contenteditable");
                saveButton.remove();
            });
        });
    }

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
