const startTaskButton = document.querySelector("#start-task");
const progressPanel = document.querySelector("#task-progress-panel");
const progressBar = document.querySelector("#task-progress");
const progressPercentage = document.querySelector("#task-percentage");
const taskStatus = document.querySelector("#task-status");
const taskBatch = document.querySelector("#task-batch");
const taskSummary = document.querySelector("#task-summary");
const taskCurrent = document.querySelector("#task-current");
const taskError = document.querySelector("#task-error");
const levelSelect = document.querySelector("#task-level");
const batchSizeInput = document.querySelector("#task-batch-size");
const estimate = document.querySelector("#task-estimate");

function normalizedBatchSize() {
  return Math.min(100, Math.max(1, Number(batchSizeInput.value || 100)));
}

function updateEstimate() {
  const total = Number(levelSelect.selectedOptions[0]?.dataset.total || 0);
  const batchSize = normalizedBatchSize();
  batchSizeInput.value = batchSize;
  estimate.textContent = `${levelSelect.value} 共 ${total} 个词汇；如果全部执行，将拆成 ${Math.ceil(total / batchSize)} 批，每批最多 ${batchSize} 条。勾选忽略后，实际任务数量可能更少。`;
}

function renderTask(task) {
  const progress = task.progress;
  const percentage = progress.total
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;
  const labels = {
    queued: "已排队",
    running: "执行中",
    completed: "已完成",
    failed: "失败",
  };
  taskStatus.textContent = `${labels[task.status] || task.status} · ${task.id}`;
  taskBatch.textContent = progress.currentBatch
    ? `正在执行第 ${progress.currentBatch}/${progress.totalBatches} 批，本批 ${progress.batchCompleted || 0}/${progress.batchTotal || 0}`
    : `共 ${progress.totalBatches} 批，等待第一批开始`;
  progressPercentage.textContent = `${percentage}%`;
  progressBar.style.width = `${percentage}%`;
  progressBar.textContent = `${progress.completed}/${progress.total}`;
  taskSummary.textContent = `总任务 ${progress.total}；已完成 ${progress.completed}；成功 ${progress.succeeded}；失败 ${progress.failed}；跳过 ${progress.skipped}`;
  taskCurrent.textContent = `当前词汇 ID：${progress.currentWordId || "等待中"}`;
  if (["completed", "failed"].includes(task.status)) {
    progressBar.classList.remove("progress-bar-animated");
    startTaskButton.disabled = false;
  }
  if (task.error) {
    taskError.textContent = task.error;
    taskError.classList.remove("d-none");
  }
}

levelSelect.addEventListener("change", updateEstimate);
batchSizeInput.addEventListener("change", updateEstimate);
updateEstimate();

startTaskButton.addEventListener("click", async () => {
  startTaskButton.disabled = true;
  taskError.classList.add("d-none");
  progressPanel.classList.remove("d-none");
  try {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskType: document.querySelector("#task-type").value,
        level: levelSelect.value,
        batchSize: normalizedBatchSize(),
        ignorePublished: document.querySelector("#ignore-published").checked,
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "创建任务失败");
    renderTask(body.task);
    const events = new EventSource(`/api/tasks/${body.task.id}/events`);
    events.onmessage = (event) => {
      const task = JSON.parse(event.data);
      renderTask(task);
      if (["completed", "failed"].includes(task.status)) events.close();
    };
    events.onerror = () => {
      if (events.readyState === EventSource.CLOSED) return;
      taskError.textContent = "任务进度连接中断，请查看服务日志。";
      taskError.classList.remove("d-none");
    };
  } catch (error) {
    taskError.textContent = error.message;
    taskError.classList.remove("d-none");
    startTaskButton.disabled = false;
  }
});
