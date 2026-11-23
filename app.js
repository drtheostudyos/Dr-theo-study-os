(() => {
  const $ = id => document.getElementById(id);
  const STORAGE = "dr-theo-study-os-v1";
  const subjects = ["Anatomy","Physiology","Biochemistry","Pathology","Pharmacology","Microbiology","PSM","Forensic Medicine","ENT","Ophthalmology","Medicine","Surgery","Obstetrics & Gynaecology","Paediatrics","Orthopaedics","Dermatology","Psychiatry","Anaesthesia","Radiology"];
  let data = loadLocal(), supabase = null, user = null, syncing = false, saveTimer = null, timerTick = null;
  data.sessions = Array.isArray(data.sessions) ? data.sessions : [];
  data.timer = data.timer || {running:false, startedAt:null, elapsed:0};
  const today = iso(new Date());
  $("todayDate").textContent = new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
  $("studyDate").value = today; $("revisionDate").value = today;
  $("subject").innerHTML = subjects.map(s=>`<option>${s}</option>`).join("");
  $("sessionSubject").innerHTML = subjects.map(s=>`<option>${s}</option>`).join("");
  $("historyDate").value = "";
  $("filterSubject").innerHTML += subjects.map(s=>`<option>${s}</option>`).join("");
  function iso(d){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
  function parseDate(s){return new Date(s+"T12:00:00")}
  function addDays(s,n){const d=parseDate(s);d.setDate(d.getDate()+n);return iso(d)}
  function daysBetween(a,b){return Math.round((parseDate(b)-parseDate(a))/86400000)}
  function uid(){return crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random().toString(16).slice(2)}
  function loadLocal(){try{return JSON.parse(localStorage.getItem(STORAGE))||{topics:[]}}catch{return {topics:[]}}}
  function persist(){localStorage.setItem(STORAGE,JSON.stringify(data)); scheduleCloudSave(); render(); renderTimerAndHistory()}
  function score(t){const last=t.revisions?.length?t.revisions[t.revisions.length-1]:t.initial;return Number(last?.recall||3)}
  function accuracy(t){const last=t.revisions?.length?t.revisions[t.revisions.length-1]:t.initial;return last?.attempted>0?100*last.correct/last.attempted:null}
  function weak(t){return score(t)<=2 || (accuracy(t)!==null && accuracy(t)<60)}
  function interval(t){
    const r=score(t), a=accuracy(t), count=t.revisions?.length||0;
    // Adaptive heuristic: poor recall/low accuracy shortens interval; strong recall expands it.
    if(r<=1 || (a!==null&&a<50)) return count===0?1:2;
    if(r===2 || (a!==null&&a<65)) return count===0?3:4;
    if(r===3 || (a!==null&&a<80)) return [1,4,8,16,30][Math.min(count,4)];
    return [2,7,14,30,60,90][Math.min(count,5)];
  }
  function nextDue(t){const last=t.revisions?.length?t.revisions[t.revisions.length-1].date:t.studyDate;return addDays(last,interval(t))}
  function dueState(t){const d=daysBetween(nextDue(t),today);return d<0?"overdue":d===0?"due":"upcoming"}
  function priority(t){const state=dueState(t), age=daysBetween(nextDue(t),today);return (weak(t)?100:0)+(state==="overdue"?50+Math.min(age,30):state==="due"?40:0)}
  function render(){
    const topics=data.topics||[], due=topics.filter(t=>dueState(t)!=="upcoming"), overdue=topics.filter(t=>dueState(t)==="overdue"), weakTopics=topics.filter(weak);
    $("dueCount").textContent=topics.filter(t=>dueState(t)==="due").length;
    $("overdueCount").textContent=overdue.length;$("topicCount").textContent=topics.length;$("weakCount").textContent=weakTopics.length;
    $("todayCount").textContent=`${due.length} due or overdue`;
    const ordered=[...due].sort((a,b)=>priority(b)-priority(a));
    $("todayList").className="topic-list"+(ordered.length?"":" empty");
    $("todayList").innerHTML=ordered.length?ordered.map(t=>topicHTML(t,true)).join(""):"No topics due today. Add completed topics or enjoy the revision buffer.";
    const fs=$("filterSubject").value, status=$("filterStatus").value;
    const filtered=topics.filter(t=>(!fs||t.subject===fs)&&(status==="all"||(status==="weak"&&weak(t))||(status==="due"&&dueState(t)!=="upcoming"))).sort((a,b)=>priority(b)-priority(a));
    $("allTopics").className="topic-list"+(filtered.length?"":" empty");
    $("allTopics").innerHTML=filtered.length?filtered.map(t=>topicHTML(t,false)).join(""):"No topics match this filter.";
    $("revisionTopic").innerHTML='<option value="">Select a topic</option>'+topics.map(t=>`<option value="${t.id}">${esc(t.subject)} — ${esc(t.name)}</option>`).join("");
  }
  function topicHTML(t,compact){
    const state=dueState(t), acc=accuracy(t), tag=weak(t)?'<span class="tag high">Weak</span>':state==="overdue"?'<span class="tag high">Overdue</span>':state==="due"?'<span class="tag mid">Due today</span>':'<span class="tag good">On track</span>';
    const accText=acc===null?"No MCQ data":`${Math.round(acc)}% accuracy`;
    return `<div class="topic-row"><div><h3>${esc(t.name)}</h3><p>${esc(t.subject)} · Studied ${t.studyDate} · Next: ${nextDue(t)} · ${accText}</p></div>${tag}<div class="row-actions">${compact?`<button data-revise="${t.id}">Revise now</button>`:""}<button data-delete="${t.id}" class="danger">Delete</button></div></div>`;
  }
  function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
  $("topicForm").addEventListener("submit",e=>{
    e.preventDefault();const attempted=Number($("attempted").value)||0,correct=Number($("correct").value)||0;
    if(correct>attempted){alert("Correct answers cannot exceed attempted MCQs.");return}
    const t={id:uid(),subject:$("subject").value,name:$("topic").value.trim(),studyDate:$("studyDate").value,notes:$("notes").value.trim(),initial:{date:$("studyDate").value,attempted,correct,recall:Number($("recall").value)},revisions:[]};
    if(!t.name||!t.studyDate)return;data.topics.push(t);$("topicForm").reset();$("studyDate").value=today;$("attempted").value=20;$("correct").value=14;persist();
  });
  $("revisionForm").addEventListener("submit",e=>{
    e.preventDefault();const t=data.topics.find(x=>x.id===$("revisionTopic").value);if(!t){alert("Select a topic first.");return}
    const attempted=Number($("revAttempted").value)||0,correct=Number($("revCorrect").value)||0;
    if(correct>attempted){alert("Correct answers cannot exceed attempted MCQs.");return}
    const date=$("revisionDate").value;if(date<t.studyDate){alert("Revision date cannot be before first study date.");return}
    t.revisions.push({date,attempted,correct,recall:Number($("revRecall").value),notes:$("revNotes").value.trim()});t.revisions.sort((a,b)=>a.date.localeCompare(b.date));
    $("revisionForm").reset();$("revisionDate").value=today;$("revAttempted").value=20;$("revCorrect").value=15;persist();
  });
  document.body.addEventListener("click",e=>{
    const del=e.target.closest("[data-delete]");if(del){if(confirm("Delete this topic and its revision history?")){data.topics=data.topics.filter(t=>t.id!==del.dataset.delete);persist()}}
    const rev=e.target.closest("[data-revise]");if(rev){$("revisionTopic").value=rev.dataset.revise;$("revisionDate").value=today;$("revisionForm").scrollIntoView({behavior:"smooth",block:"center"})}
  });
  $("filterSubject").addEventListener("change",render);$("filterStatus").addEventListener("change",render);
  $("showAllBtn").addEventListener("click",()=>$("allTopics").scrollIntoView({behavior:"smooth"}));
  $("exportBtn").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="dr-theo-study-backup.json";a.click();URL.revokeObjectURL(a.href)});
  $("importFile").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const x=JSON.parse(await f.text());if(!Array.isArray(x.topics))throw Error("Invalid backup");x.sessions=Array.isArray(x.sessions)?x.sessions:[];x.timer=x.timer||{running:false,startedAt:null,elapsed:0};if(!confirm("Import will replace current local data. Continue?"))return;data=x;persist();alert("Backup imported.")}catch(err){alert("Could not import: "+err.message)}e.target.value=""});
  $("clearLocal").addEventListener("click",()=>{if(confirm("This clears local data on this device. Export a backup first. Continue?")){data={topics:[],sessions:[],timer:{running:false,startedAt:null,elapsed:0}};persist();stopTicker()}});

  // Study timer: elapsed time is persisted, so a reload does not lose a running session.
  function elapsedNow(){return Math.max(0,Number(data.timer.elapsed||0)+(data.timer.running&&data.timer.startedAt?Math.floor((Date.now()-data.timer.startedAt)/1000):0))}
  function fmt(seconds){seconds=Math.max(0,Math.floor(seconds));const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),sec=seconds%60;return [h,m,sec].map(n=>String(n).padStart(2,"0")).join(":")}
  function compactTime(seconds){const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60);return h?`${h}h ${m}m`:`${m}m`}
  function stopTicker(){if(timerTick){clearInterval(timerTick);timerTick=null}}
  function startTicker(){stopTicker();timerTick=setInterval(renderTimerAndHistory,1000)}
  function renderTimerAndHistory(){
    const running=!!data.timer.running, elapsed=elapsedNow();
    $("timerDisplay").textContent=fmt(elapsed);$("timerStatus").textContent=running?"Running":"Paused / stopped";
    $("timerStart").disabled=running;$("timerPause").disabled=!running;$("timerFinish").disabled=elapsed<=0;
    const sessions=data.sessions||[], todaySessions=sessions.filter(x=>x.date===today), weekStart=addDays(today,-6);
    const sum=arr=>arr.reduce((n,x)=>n+Number(x.duration||0),0);
    const todaySeconds=sum(todaySessions)+(running?elapsed:0);
    const weekSeconds=sum(sessions.filter(x=>x.date>=weekStart&&x.date<=today))+(running?elapsed:0);
    const allSeconds=sum(sessions)+(running?elapsed:0);
    $("studyToday").textContent=compactTime(todaySeconds);$("studyWeek").textContent=compactTime(weekSeconds);$("studyTotal").textContent=compactTime(allSeconds);
    const filter=$("historyDate").value;const shown=[...sessions].filter(x=>!filter||x.date===filter).sort((a,b)=>(b.startedAt||"").localeCompare(a.startedAt||""));
    $("sessionHistory").className="topic-list"+(shown.length?"":" empty");
    $("sessionHistory").innerHTML=shown.length?shown.map(x=>`<div class="topic-row"><div><h3>${esc(x.subject||"Study session")}${x.topic?" · "+esc(x.topic):""}</h3><p>${esc(x.date)} · ${new Date(x.startedAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}${x.endedAt?" – "+new Date(x.endedAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}):""}${x.note?" · "+esc(x.note):""}</p></div><span class="tag good">${fmt(x.duration||0)}</span><div class="row-actions"><button data-session-delete="${x.id}" class="danger">Delete</button></div></div>`).join(""):"No saved sessions for this date.";
  }
  $("timerStart").addEventListener("click",()=>{if(data.timer.running)return;data.timer.running=true;data.timer.startedAt=Date.now();if(!data.timer.sessionStartedAt)data.timer.sessionStartedAt=new Date().toISOString();data.timer.subject=$("sessionSubject").value;data.timer.topic=$("sessionTopic").value.trim();data.timer.note=$("sessionNote").value.trim();persist();startTicker()});
  $("timerPause").addEventListener("click",()=>{if(!data.timer.running)return;data.timer.elapsed=elapsedNow();data.timer.running=false;data.timer.startedAt=null;persist();stopTicker()});
  $("timerFinish").addEventListener("click",()=>{const duration=elapsedNow();if(duration<60&&!confirm("This session is under one minute. Save it anyway?"))return;if(duration>0){const start=data.timer.sessionStartedAt||new Date(Date.now()-duration*1000).toISOString();data.sessions.push({id:uid(),date:iso(new Date(start)),startedAt:start,endedAt:new Date().toISOString(),duration,subject:data.timer.subject||$("sessionSubject").value,topic:data.timer.topic||$("sessionTopic").value.trim(),note:data.timer.note||$("sessionNote").value.trim()})}data.timer={running:false,startedAt:null,elapsed:0};persist();stopTicker()});
  $("historyDate").addEventListener("change",renderTimerAndHistory);
  document.body.addEventListener("click",e=>{const b=e.target.closest("[data-session-delete]");if(b&&confirm("Delete this study session from history?")){data.sessions=data.sessions.filter(x=>x.id!==b.dataset.sessionDelete);persist()}});
  if(data.timer.running)startTicker();
  document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    renderTimerAndHistory();
    if (data.timer.running) startTicker();
  } else {
    stopTicker();
  }
});

window.addEventListener("pageshow", () => {
  renderTimerAndHistory();
  if (data.timer.running) startTicker();
});
  function configReady(){const c=window.DR_THEO_CONFIG||{};return c.SUPABASE_URL?.startsWith("https://")&&c.SUPABASE_ANON_KEY&&!c.SUPABASE_ANON_KEY.includes("PASTE_")}
  if (configReady() && window.supabase) {
  const c = window.DR_THEO_CONFIG;

  supabase = window.supabase.createClient(
    c.SUPABASE_URL,
    c.SUPABASE_ANON_KEY
  );

  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      setSync("Session error");
      console.error(error);
      return;
    }

    if (data.session) {
      user = data.session.user;
      loadCloud();
    }
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    user = session?.user || null;
    if (user) loadCloud();
    else setSync("Local mode");
  });
  }
  function setSync(s){$("syncState").textContent=s}
  function scheduleCloudSave(){if(!user||!supabase)return;clearTimeout(saveTimer);saveTimer=setTimeout(saveCloud,900)}
  async function saveCloud(){if(!user||!supabase||syncing)return;syncing=true;setSync("Syncing…");const {error}=await supabase.from("study_data").upsert({user_id:user.id,data:data,updated_at:new Date().toISOString()});syncing=false;if(error){setSync("Sync error");console.error(error)}else setSync("Cloud synced")}
  async function loadCloud(){if(!user||!supabase)return;setSync("Loading cloud…");const {data:row,error}=await supabase.from("study_data").select("data").eq("user_id",user.id).maybeSingle();if(error){setSync("Cloud error");alert("Cloud load failed: "+error.message);return}if(row?.data){data=row.data;data.sessions=Array.isArray(data.sessions)?data.sessions:[];data.timer=data.timer||{running:false,startedAt:null,elapsed:0};localStorage.setItem(STORAGE,JSON.stringify(data));render();renderTimerAndHistory();if(data.timer.running)startTicker();else stopTicker()}else await saveCloud();setSync("Cloud synced")}
  $("authToggle").addEventListener("click",()=>{if(!$("authDialog").open)$("authDialog").showModal()});
  
async function auth(mode) {
  const msg = $("authMessage");
  if (!supabase) {
    msg.textContent = "Supabase not connected. Check config.js URL and anon key.";
    return;
  }

  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    msg.textContent = "Enter email and password.";
    return;
  }

  msg.textContent = "Please wait...";

  try {
    const result = mode === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      msg.textContent = result.error.message;
      return;
    }

    if (mode === "signup" && !result.data.session) {
      msg.textContent = "Account created. Verify your email, then sign in.";
      return;
    }

    user = result.data.user;
    await loadCloud();

    msg.textContent = "Signed in successfully.";
    $("authDialog").close();

  } catch (error) {
    msg.textContent = "Error: " + error.message;
  }
}
  
  $("signInBtn").addEventListener("click",()=>auth("signin"));$("signUpBtn").addEventListener("click",()=>auth("signup"));
  $("signOutBtn").addEventListener("click",async()=>{await supabase?.auth.signOut();user=null;setSync("Local mode");$("authMessage").textContent="Signed out."});
  render();
  renderTimerAndHistory();
})();
