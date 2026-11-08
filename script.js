const form = document.getElementById("analysisForm");
const fileInput = document.getElementById("resumeFile");
const uploadBox = document.getElementById("uploadBox");
const formStatus = document.getElementById("formStatus");
const analyzeButton = document.getElementById("analyzeButton");
const historyKey = "resumescore.analysis-history.v1";
let selectedFile = null;
let currentObjectUrl = null;
let currentAnalysis = null;
let toastTimer;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function setSelectedFile(file) {
  if (!file) return;
  const extension = file.name.split(".").pop().toLowerCase();
  if (!["pdf", "docx", "txt"].includes(extension)) {
    showToast("Choose a PDF, DOCX, or TXT file.");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("This file is over the 5 MB limit.");
    return;
  }
  selectedFile = file;
  document.getElementById("uploadTitle").textContent = file.name;
  document.getElementById("uploadSub").textContent = "File ready for analysis.";
  document.getElementById("fileType").textContent = extension.toUpperCase();
  document.getElementById("fileMeta").textContent = `${(file.size / 1024).toFixed(0)} KB · ${extension.toUpperCase()}`;
  const preview = document.getElementById("previewBody");
  const download = document.getElementById("downloadResume");
  download.hidden = false;
  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  currentObjectUrl = URL.createObjectURL(file);
  download.href = currentObjectUrl;
  download.download = file.name;
  if (extension === "pdf") {
    preview.innerHTML = `<iframe title="Resume PDF preview" src="${currentObjectUrl}"></iframe>`;
  } else if (extension === "txt") {
    const reader = new FileReader();
    reader.onload = () => {
      preview.innerHTML = `<pre>${escapeHtml(String(reader.result).slice(0, 12000))}</pre>`;
    };
    reader.readAsText(file);
  } else {
    preview.innerHTML = `<div class="empty-document"><span>▤</span><strong>${escapeHtml(file.name)}</strong><p>DOCX is ready. A browser preview is not available, but its text will be analyzed.</p></div>`;
  }
}

fileInput.addEventListener("change", () => setSelectedFile(fileInput.files[0]));
["dragenter", "dragover"].forEach((eventName) => uploadBox.addEventListener(eventName, (event) => {
  event.preventDefault();
  uploadBox.classList.add("dragging");
}));
["dragleave", "drop"].forEach((eventName) => uploadBox.addEventListener(eventName, (event) => {
  event.preventDefault();
  uploadBox.classList.remove("dragging");
}));
uploadBox.addEventListener("drop", (event) => setSelectedFile(event.dataTransfer.files[0]));

function getHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(historyKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveHistory(item) {
  const history = [item, ...getHistory()].slice(0, 10);
  try {
    localStorage.setItem(historyKey, JSON.stringify(history));
    renderHistory();
  } catch {
    showToast("Analysis succeeded, but this browser could not save local history.");
  }
}

function renderHistory() {
  const history = getHistory();
  const list = document.getElementById("historyList");
  const clearButton = document.getElementById("clearHistory");
  clearButton.hidden = history.length === 0;
  if (!history.length) {
    list.innerHTML = '<div class="history-empty"><span>◷</span><p>Your analyses will appear here after your first report.</p></div>';
    return;
  }
  list.innerHTML = history.map((item, index) => `
    <div class="history-item">
      <div><strong>${escapeHtml(item.resumeName)}</strong><small>${escapeHtml(new Date(item.date).toLocaleString())}</small></div>
      <div><strong>${escapeHtml(item.jobTitle || "General resume review")}</strong><small>Target role</small></div>
      <div class="history-score">${item.score == null ? "—" : `${escapeHtml(item.score)}/100`}</div>
      <button type="button" data-history-index="${index}">View report →</button>
    </div>`).join("");
  list.querySelectorAll("[data-history-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = getHistory()[Number(button.dataset.historyIndex)];
      if (selected) renderResults(selected.analysis, selected);
    });
  });
}

document.getElementById("clearHistory").addEventListener("click", () => {
  localStorage.removeItem(historyKey);
  renderHistory();
  showToast("Local analysis history cleared.");
});

function renderList(title, values, className = "") {
  if (!Array.isArray(values) || !values.length) return "";
  return `<div class="content-group"><h4>${escapeHtml(title)}</h4><div class="${className}">${className === "tag-list"
    ? values.map((value) => `<span class="tag ${title.toLowerCase().includes("missing") ? "missing" : title.toLowerCase().includes("keyword") ? "keyword" : ""}">${escapeHtml(value)}</span>`).join("")
    : `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`}</div></div>`;
}

function renderCategoryCards(analysis) {
  const labels = { skills: "Skills", experience: "Experience", timeline: "Timeline", location: "Location" };
  document.getElementById("scoreCategories").innerHTML = Object.entries(labels).map(([key, label]) => {
    const category = analysis.category_scores?.[key] || {};
    return `<div class="mini-score"><span>${label}</span><strong>${category.score == null ? "—" : `${escapeHtml(category.score)}%`}</strong><small>${escapeHtml(category.status || "Not provided")}</small></div>`;
  }).join("");
}

function renderResults(analysis, metadata = {}) {
  currentAnalysis = analysis;
  document.getElementById("results").hidden = false;
  const score = analysis.overall_score;
  document.getElementById("overallScore").textContent = score == null ? "—" : score;
  document.getElementById("scoreLabel").textContent = analysis.score_label || "Analysis complete";
  document.getElementById("scoreCaption").textContent = score == null
    ? "Not enough assessable information was provided to calculate a score."
    : `Calculated from available categories. ${analysis.scoring_weights ? "Category weights: skills 35%, experience 35%, timeline 15%, location 15%." : ""}`;
  document.getElementById("overallRing").style.setProperty("--progress", `${score == null ? 0 : Math.max(0, Math.min(100, score)) * 3.6}deg`);
  renderCategoryCards(analysis);
  const categories = analysis.category_scores || {};
  const skills = [
    renderList("Matching skills", analysis.matching_skills, "tag-list"),
    renderList("Skills to verify or learn", analysis.missing_skills, "tag-list"),
    renderList("Additional relevant skills", analysis.additional_skills, "tag-list"),
    `<div class="content-group"><h4>Assessment</h4><p>${escapeHtml(categories.skills?.feedback || "No skills assessment was provided.")}</p></div>`
  ].join("");
  document.getElementById("skillsContent").innerHTML = skills;
  document.getElementById("experienceContent").innerHTML = [
    `<div class="content-group"><h4>Assessment</h4><p>${escapeHtml(categories.experience?.feedback || "No experience assessment was provided.")}</p></div>`,
    renderList("Strengths", analysis.strengths),
    renderList("Areas to improve", analysis.weaknesses)
  ].join("");
  document.getElementById("timelineContent").innerHTML = [
    `<div class="content-group"><h4>Assessment</h4><p>${escapeHtml(categories.timeline?.feedback || "No timeline assessment was provided.")}</p></div>`,
    renderList("Neutral observations", analysis.timeline_observations)
  ].join("");
  document.getElementById("locationContent").innerHTML = `<div class="content-group"><h4>Assessment</h4><p>${escapeHtml(categories.location?.feedback || "Location details were not provided.")}</p></div>`;
  const examples = Array.isArray(analysis.before_after_examples) ? analysis.before_after_examples : [];
  document.getElementById("improvementsContent").innerHTML = [
    analysis.improved_summary ? `<div class="content-group"><h4>Suggested professional summary</h4><p>${escapeHtml(analysis.improved_summary)}</p></div>` : "",
    renderList("Recommended actions", analysis.improvement_suggestions),
    renderList("Matching keywords", analysis.matching_keywords, "tag-list"),
    renderList("Missing keywords to verify", analysis.missing_keywords, "tag-list"),
    examples.length ? `<div class="content-group"><h4>Before & after</h4>${examples.map((item) => `<div class="before-after"><div><b>BEFORE</b><p>${escapeHtml(item.before)}</p></div><div class="after"><b>AFTER</b><p>${escapeHtml(item.after)}</p></div></div>${item.rationale ? `<p>${escapeHtml(item.rationale)}</p>` : ""}`).join("")}</div>` : ""
  ].join("") || '<p>No improvement suggestions were returned.</p>';
  document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function responseMessage(payload, fallback) {
  if (payload && typeof payload.detail === "string") return payload.detail;
  return fallback;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const pastedText = document.getElementById("resumeText").value.trim();
  if (!selectedFile && !pastedText) {
    formStatus.textContent = "Upload a resume or paste resume text before analyzing.";
    formStatus.className = "form-status error";
    return;
  }
  const data = new FormData();
  if (selectedFile) data.append("file", selectedFile);
  if (pastedText) data.append("resume_text", pastedText);
  ["job_description", "preferred_location", "job_location", "work_arrangement", "target_job_title"].forEach((name) => {
    data.append(name, document.getElementById(name === "target_job_title" ? "targetJobTitle" : name === "job_description" ? "jobDescription" : name === "preferred_location" ? "preferredLocation" : name === "job_location" ? "jobLocation" : "workArrangement").value);
  });
  analyzeButton.disabled = true;
  analyzeButton.querySelector("span:first-child").textContent = "Analyzing your resume...";
  formStatus.className = "form-status";
  formStatus.textContent = "Reviewing the information you provided. This can take a few moments.";
  try {
    const response = await fetch("/api/analyze", { method: "POST", body: data });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(responseMessage(payload, `Analysis failed (${response.status}). Please try again.`));
    renderResults(payload);
    const item = {
      resumeName: selectedFile?.name || "Pasted resume",
      jobTitle: document.getElementById("targetJobTitle").value.trim(),
      score: payload.overall_score,
      date: payload.analysis_date || new Date().toISOString(),
      analysis: payload
    };
    saveHistory(item);
    formStatus.textContent = "Analysis complete. Your report is ready below.";
    formStatus.className = "form-status success";
  } catch (error) {
    formStatus.textContent = error.message || "Could not reach the analysis service. Check your connection and try again.";
    formStatus.className = "form-status error";
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.querySelector("span:first-child").textContent = "Analyze my resume";
  }
});

document.getElementById("downloadReport").addEventListener("click", async () => {
  if (!currentAnalysis) return;
  const button = document.getElementById("downloadReport");
  button.disabled = true;
  try {
    const response = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_name: selectedFile?.name || "Pasted resume",
        target_job_title: document.getElementById("targetJobTitle").value.trim(),
        analysis_date: currentAnalysis.analysis_date,
        analysis: currentAnalysis
      })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(responseMessage(payload, "Report download failed."));
    }
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "resumescore-analysis.pdf";
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    showToast(error.message || "Could not download the report.");
  } finally {
    button.disabled = false;
  }
});

document.querySelectorAll(".side-nav .nav-link, .sidebar-bottom .nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".side-nav .nav-link").forEach((item) => item.classList.toggle("active", item === link));
    document.getElementById("sidebar").classList.remove("open");
  });
});
document.getElementById("menuButton").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
document.addEventListener("click", (event) => {
  const sidebar = document.getElementById("sidebar");
  if (sidebar.classList.contains("open") && !sidebar.contains(event.target) && event.target.id !== "menuButton") sidebar.classList.remove("open");
});
renderHistory();
