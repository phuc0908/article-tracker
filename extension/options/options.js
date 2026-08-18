// =====================================================
// ELEMENTS
// =====================================================

const nameInput =
    document.getElementById(
        "name"
    );

const domainInput =
    document.getElementById(
        "domain"
    );

const selectorInput =
    document.getElementById(
        "selector"
    );

const saveButton =
    document.getElementById(
        "saveButton"
    );

const cancelButton =
    document.getElementById(
        "cancelButton"
    );

const websiteList =
    document.getElementById(
        "websiteList"
    );

const websiteCount =
    document.getElementById(
        "websiteCount"
    );


// =====================================================
// STATE
// =====================================================

let editingId = null;


// =====================================================
// STORAGE
// =====================================================

async function getWebsites() {

    const result =
        await chrome.storage.local.get(
            "websites"
        );


    return result.websites || [];

}


async function saveWebsites(
    websites
) {

    await chrome.storage.local.set({
        websites
    });

}


// =====================================================
// RENDER
// =====================================================

async function renderWebsites() {

    const websites =
        await getWebsites();


    websiteCount.textContent =
        websites.length;


    if (
        websites.length === 0
    ) {

        websiteList.innerHTML = `
            <div class="empty">
                Chưa có website nào.
            </div>
        `;

        return;
    }


    websiteList.innerHTML =
        websites
            .map(
                website =>
                    renderWebsite(
                        website
                    )
            )
            .join("");


    attachActions();

}


// =====================================================
// RENDER WEBSITE
// =====================================================

function renderWebsite(
    website
) {

    return `
        <div
            class="website-item"
            data-id="${escapeHtml(
                website.id
            )}"
        >

            <div class="website-info">

                <div class="website-name">
                    ${escapeHtml(
                        website.name
                    )}
                </div>

                <div class="website-domain">
                    ${escapeHtml(
                        website.domain
                    )}
                </div>

                <div class="website-selector">

                    Selector:
                    <code>
                        ${escapeHtml(
                            website.articleSelector
                        )}
                    </code>

                </div>

            </div>


            <div class="website-actions">

                <button
                    class="edit-button"
                    data-id="${escapeHtml(
                        website.id
                    )}"
                >
                    Edit
                </button>

                <button
                    class="delete-button"
                    data-id="${escapeHtml(
                        website.id
                    )}"
                >
                    Delete
                </button>

            </div>

        </div>
    `;

}


// =====================================================
// ACTIONS
// =====================================================

function attachActions() {

    document
        .querySelectorAll(
            ".edit-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    editWebsite(
                        button.dataset.id
                    );

                }
            );

        });


    document
        .querySelectorAll(
            ".delete-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    deleteWebsite(
                        button.dataset.id
                    );

                }
            );

        });

}


// =====================================================
// ADD / EDIT
// =====================================================

saveButton.addEventListener(
    "click",
    async () => {

        const name =
            nameInput.value.trim();


        const domain =
            normalizeDomain(
                domainInput.value
            );


        const selector =
            selectorInput.value.trim();


        if (
            !name ||
            !domain ||
            !selector
        ) {

            alert(
                "Vui lòng nhập đầy đủ thông tin."
            );

            return;
        }


        // Validate selector

        try {

            document.querySelector(
                selector
            );

        } catch (error) {

            alert(
                "CSS Selector không hợp lệ."
            );

            return;
        }


        const websites =
            await getWebsites();


        // EDIT

        if (editingId) {

            const index =
                websites.findIndex(
                    website =>
                        website.id ===
                        editingId
                );


            if (index !== -1) {

                websites[index] = {

                    ...websites[index],

                    name,

                    domain,

                    articleSelector:
                        selector

                };

            }

        }

        // ADD

        else {

            // Prevent duplicate domain

            const exists =
                websites.some(
                    website =>
                        normalizeDomain(
                            website.domain
                        ) === domain
                );


            if (exists) {

                alert(
                    "Domain này đã tồn tại."
                );

                return;
            }


            websites.push({

                id:
                    crypto.randomUUID(),

                name,

                domain,

                articleSelector:
                    selector

            });

        }


        await saveWebsites(
            websites
        );


        resetForm();

        await renderWebsites();

    }
);


// =====================================================
// EDIT
// =====================================================

async function editWebsite(
    id
) {

    const websites =
        await getWebsites();


    const website =
        websites.find(
            item =>
                item.id === id
        );


    if (!website) {
        return;
    }


    nameInput.value =
        website.name;


    domainInput.value =
        website.domain;


    selectorInput.value =
        website.articleSelector;


    editingId = id;


    saveButton.textContent =
        "Save Changes";


    cancelButton.classList.remove(
        "hidden"
    );

}


// =====================================================
// DELETE
// =====================================================

async function deleteWebsite(
    id
) {

    const confirmed =
        confirm(
            "Bạn có chắc muốn xóa website này?"
        );


    if (!confirmed) {
        return;
    }


    let websites =
        await getWebsites();


    websites =
        websites.filter(
            website =>
                website.id !== id
        );


    await saveWebsites(
        websites
    );


    await renderWebsites();

}


// =====================================================
// CANCEL
// =====================================================

cancelButton.addEventListener(
    "click",
    resetForm
);


function resetForm() {

    nameInput.value = "";

    domainInput.value = "";

    selectorInput.value = "";

    editingId = null;


    saveButton.textContent =
        "+ Add Website";


    cancelButton.classList.add(
        "hidden"
    );

}


// =====================================================
// NORMALIZE DOMAIN
// =====================================================

function normalizeDomain(
    domain
) {

    return domain
        .trim()
        .toLowerCase()
        .replace(
            /^https?:\/\//,
            ""
        )
        .replace(
            /^www\./,
            ""
        )
        .replace(
            /\/.*$/,
            ""
        );

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHtml(
    value
) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// =====================================================
// INIT
// =====================================================

renderWebsites();