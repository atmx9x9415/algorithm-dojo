// 算法道场 主脚本
document.addEventListener('DOMContentLoaded', function () {
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () { navLinks.classList.toggle('open'); });
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { navLinks.classList.remove('open'); });
    });
  }
});

function openModal(id) {
  var modal = document.getElementById(id);
  if (modal) { modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  var modal = document.getElementById(id);
  if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; }
}
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
    closeModal(e.target.id);
  }
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(function (m) { closeModal(m.id); });
  }
});
