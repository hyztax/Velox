document.addEventListener("DOMContentLoaded", () => {
  const faqQuestions = document.querySelectorAll(".faq-question");

  faqQuestions.forEach((question) => {
    question.addEventListener("click", () => {
      const answer = question.nextElementSibling;

      // Toggle active state
      question.classList.toggle("active");

      if (answer.style.maxHeight) {
        answer.style.maxHeight = null;
        answer.style.paddingTop = "0";
        answer.style.paddingBottom = "0";
      } else {
        answer.style.maxHeight = answer.scrollHeight + "px";
        answer.style.paddingTop = "5px";
        answer.style.paddingBottom = "15px";
      }
    });
  });
});
