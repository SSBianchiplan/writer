// Aplica o tema salvo antes da primeira pintura (evita piscar claro→escuro).
try{var t=localStorage.getItem('gpw:theme');if(t)document.documentElement.dataset.theme=t}catch(e){}
