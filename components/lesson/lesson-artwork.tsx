export function LumoraCharacterArt({ variant = "laptop" }: { variant?: "laptop" | "robot" }) {
  return (
    <svg className={`lesson-character-art art-${variant}`} viewBox="0 0 420 300" role="img" aria-label={variant === "robot" ? "Student exploring AI with a robotic arm" : "Student learning with an AI assistant"}>
      <path d="M72 250c-22-94 1-173 68-193 70-21 158 6 213 94l-18 99z" fill="#f6d6ff" />
      <circle cx="218" cy="76" r="42" fill="#ffb385" />
      <path d="M181 70c4-44 71-58 82-5-21-14-40-1-46 11-12-11-26-6-36-6z" fill="#202044" />
      <rect x="175" y="111" width="118" height="128" rx="29" fill="#8050e8" />
      <path d="M188 238h40v60h-40zm55 0h40v60h-40z" fill="#1d4f99" />
      <rect x="205" y="94" width="10" height="23" rx="5" fill="#ff9d73" />
      <rect x="190" y="75" width="29" height="20" rx="5" fill="none" stroke="#15151a" strokeWidth="5" />
      <rect x="221" y="75" width="29" height="20" rx="5" fill="none" stroke="#15151a" strokeWidth="5" />
      <path d="M219 84h4m25 35c-14 10-27 10-39 0" fill="none" stroke="#15151a" strokeWidth="4" strokeLinecap="round" />
      <circle cx="198" cy="144" r="18" fill="#f5e7c8" /><path d="M190 144h16m-8-8v16" stroke="#7150cc" strokeWidth="4" />
      {variant === "laptop" ? (
        <>
          <path d="M65 176h147l23 89H86z" fill="#10243b" /><circle cx="151" cy="218" r="10" fill="#fff" />
          <circle cx="106" cy="76" r="39" fill="#70b2ff" /><path d="M82 78c0-25 36-37 48-14 23-7 33 27 12 37-6 19-37 12-37-5-14 3-23-7-23-18z" fill="none" stroke="#fff" strokeWidth="6" />
          <path d="M135 134l43-35 25 51-52 23z" fill="#fff" stroke="#70b2ff" strokeWidth="7" />
          <path d="M151 122l12 7m-16 10l19 10" stroke="#bbb" strokeWidth="4" />
        </>
      ) : (
        <>
          <rect x="287" y="163" width="105" height="70" rx="8" fill="#e0efff" /><path d="M296 234h88v13h-88z" fill="#71b2f8" />
          <path d="M300 174c18-20 35-36 61-27l18-35" fill="none" stroke="#71b2f8" strokeWidth="15" strokeLinecap="round" />
          <circle cx="360" cy="146" r="12" fill="#acd4ff" /><circle cx="379" cy="111" r="10" fill="#acd4ff" />
          <path d="M382 101l-9-34" stroke="#ff574f" strokeWidth="12" strokeLinecap="round" />
          <path d="M39 249h375" stroke="#ff574f" strokeWidth="9" />
        </>
      )}
    </svg>
  );
}

export function ChatInterfaceMock({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`chat-interface-mock ${compact ? "compact" : ""}`} aria-label="ChatGPT intelligence menu illustration">
      <p>{compact ? "What’s on your mind today?" : "Ready when you are."}</p>
      <div className="mock-input"><span>＋</span><small>Ask ChatGPT</small><b>Instant⌄</b><i>◉</i></div>
      <div className="mock-chips"><span>Create an image</span><span>Write or edit</span><span>Look something up</span></div>
      <div className="mock-menu"><small>Intelligence</small><strong>Instant <b>✓</b></strong><strong>Medium</strong><strong>High</strong><strong>GPT-5.6 Sol ›</strong></div>
      <em>Lumora</em>
    </div>
  );
}

export function ChatWorkMock() {
  return (
    <div className="chat-work-mock" aria-label="Chat and Work mode illustration">
      <div><strong>Chat</strong><span>Work</span></div>
      <p>What’s on the agenda today?</p>
      <i>＋　 Ask ChatGPT <b>High⌄　◉</b></i>
      <small>Create an image　　Write or edit　　Look something up</small>
      <em>Lumora</em>
    </div>
  );
}
