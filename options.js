const provider = document.querySelector("#provider");
const save = document.querySelector("#save");
const status = document.querySelector("#status");

chrome.storage.sync.get({ defaultProvider: "google" }, (settings) => {
  provider.value = settings.defaultProvider;
});

save.addEventListener("click", () => {
  chrome.storage.sync.set({ defaultProvider: provider.value }, () => {
    status.textContent = "Saved";
    setTimeout(() => { status.textContent = ""; }, 1500);
  });
});
