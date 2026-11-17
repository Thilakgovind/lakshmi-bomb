(() => {
  const library = document.getElementById("resourceLibrary");
  const { concepts, videos, readings, quiz } = window.smithMatchLabData;

  function element(tag, content) {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function disclosure(title) {
    const details = element("details");
    details.append(element("summary", title));
    return details;
  }

  const conceptSection = disclosure("Concept Q&A");
  for (const concept of concepts) {
    const entry = disclosure(concept.question);
    const formula = element("p", concept.formula);
    formula.className = "equation";
    entry.append(
      element("p", concept.shortAnswer),
      formula,
      element("p", concept.symbolDefinitions),
      element("p", concept.whyItMatters)
    );
    conceptSection.append(entry);
  }

  function resourceList(title, resources, description) {
    const section = disclosure(title);
    const list = element("ul");
    for (const resource of resources) {
      const link = element("a", resource.title);
      link.href = resource.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      const item = element("li");
      item.append(link, element("p", description(resource)));
      list.append(item);
    }
    section.append(list);
    return section;
  }

  const quizSection = disclosure("Practice quiz · default 50 Ω example");
  for (const question of quiz) {
    const entry = disclosure(question.question);
    const options = element("ol");
    const feedback = element("p");
    feedback.setAttribute("aria-live", "polite");
    question.options.forEach((option, index) => {
      const item = element("li");
      const button = element("button", option);
      button.type = "button";
      button.addEventListener("click", () => {
        feedback.textContent = index === question.correctIndex
          ? "Correct. " + question.explanation
          : "Try again. " + question.hint;
      });
      item.append(button);
      options.append(item);
    });
    const hint = disclosure("Hint");
    hint.append(element("p", question.hint));
    entry.append(options, hint, feedback);
    quizSection.append(entry);
  }

  library.append(
    conceptSection,
    resourceList("Videos", videos, video => video.educator + " · " + video.learningObjective),
    resourceList("Readings", readings, reading => reading.authorOrSource + " · " + reading.keyTakeaway),
    quizSection
  );
})();
