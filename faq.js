document.querySelectorAll('.faq-question').forEach(button => {
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', !expanded);

    const answerId = button.getAttribute('aria-controls');
    const answer = document.getElementById(answerId);
    if (!answer) return;

    if (expanded) {
      answer.hidden = true;
    } else {
      answer.hidden = false;
    }
  });
});

// Back button functionality
document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = 'main.html';
});
