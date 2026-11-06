try {
 const term=new Terminal({cols:100,rows:30,scrollback:500});
 term.open(document.getElementById('terminal'));
 term.onData(data=>window.probe.input(data));
 let sent=false;
 const observe=()=>{const b=term.buffer.active;const lines=Array.from({length:b.length},(_,i)=>b.getLine(i)?.translateToString(true)||'');window.probe.capture(lines.join('\n'));return lines;};
 setInterval(observe,3000);
 window.probe.onData(data=>term.write(data,()=>{
  const b=term.buffer.active;
  const lines=Array.from({length:b.length},(_,i)=>b.getLine(i)?.translateToString(true)||'');
  if(!sent && lines.some(line=>line.trim().startsWith('> Plan mode:'))){sent=true;setTimeout(()=>term.input('Reply with the one-word result of joining these five letters: O R B I T\r',true),500);}
  if(lines.some(line=>line.trim()==='ORBIT'))window.probe.verified('Electron xterm rendered the live AGY synthetic answer ORBIT');
 }));
 window.probe.onReady(()=>{});
 window.probe.start();
}catch(e){window.probe.failed(e.stack)}
