const messageBox = document.querySelector("#message");
const countBox = document.querySelector("#selection-count");
const migrateButton = document.querySelector("#migrate-images");
const checkboxes = [...document.querySelectorAll(".word-select")];

function selectedWordIds() {
  return checkboxes
    .filter((item) => item.checked)
    .map((item) => Number(item.value));
}

function showMessage(type, message) {
  messageBox.innerHTML = `<div class="alert alert-${type}"></div>`;
  messageBox.firstElementChild.textContent = message;
}

function updateSelection() {
  const count = selectedWordIds().length;
  countBox.textContent = `已选择 ${count} 个词汇`;
  migrateButton.disabled = count === 0;
}

checkboxes.forEach((item) => item.addEventListener("change", updateSelection));

document.querySelector("#select-category").addEventListener("click", () => {
  const checked = checkboxes.some((item) => !item.checked);
  checkboxes.forEach((item) => {
    item.checked = checked;
  });
  updateSelection();
});

document
  .querySelector("#operation-level")
  .addEventListener("change", (event) => {
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("level", event.target.value);
    location.assign(url);
  });

migrateButton.addEventListener("click", async () => {
  migrateButton.disabled = true;
  migrateButton.textContent = "正在迁移图片…";
  try {
    const response = await fetch("/api/images/migrate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wordIds: selectedWordIds() }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "迁移失败");
    const success = body.results.filter((item) => item.ok).length;
    showMessage(
      "success",
      `图片迁移完成：成功 ${success}，失败 ${body.results.length - success}。正在刷新状态…`,
    );
    setTimeout(() => location.reload(), 600);
  } catch (error) {
    showMessage("danger", error.message);
    migrateButton.disabled = false;
  } finally {
    migrateButton.textContent = "上传所选图片到七牛";
  }
});

document.querySelectorAll(".enrich").forEach((button) => {
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "处理中…";
    try {
      const response = await fetch(`/api/words/${button.dataset.id}/enrich`, {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "处理失败");
      showMessage("success", "发音处理完成，正在刷新状态…");
      location.reload();
    } catch (error) {
      showMessage("danger", error.message);
      button.disabled = false;
      button.textContent = "重试";
    }
  });
});
