let tournamentRounds = [];

// --- 1. FORMATTING HELPER (Seeds & Brackets) ---
/**
 * Adds bolding and rank brackets to seeded players.
 * Ensures "BYE" or "TBD" are never bolded.
 */
function formatPlayerDisplay(name) {
    if (name === "TBD" || name === "BYE" || name === "???") return name;
    
    const seeded = document.getElementById('seededPlayers').value
        .split('\n')
        .map(p => p.trim())
        .filter(p => p !== "");
    
    const seedIndex = seeded.indexOf(name);
    // If player is in the seeded list, return bold name with rank in brackets
    if (seedIndex !== -1) {
        return `<strong>${name} (${seedIndex + 1})</strong>`;
    }
    return name;
}

// --- 2. GENERATE DRAW ---
document.getElementById('generateBtn').addEventListener('click', () => {
    const title = document.getElementById('tournamentTitleInput').value || "Tournament Draw";
    const nSeeds = parseInt(document.getElementById('numSeeds').value) || 0;
    const seeded = document.getElementById('seededPlayers').value
        .split('\n')
        .map(p => p.trim())
        .filter(p => p !== "");
    const unseeded = document.getElementById('unseededPlayers').value
        .split('\n')
        .map(p => p.trim())
        .filter(p => p !== "");
    
    // Validation for BITS Goa standards
    if (seeded.length !== nSeeds) {
        return alert(`Configuration Error: Expected ${nSeeds} seeds, but found ${seeded.length} names.`);
    }
    
    document.getElementById('displayTitle').innerText = title;
    
    // Calculate smallest power of 2 for total slots
    const totalSlots = Math.pow(2, Math.ceil(Math.log2(seeded.length + unseeded.length)));
    
    const finalOrder = generateInvertedSeeding(seeded, unseeded, nSeeds, totalSlots);
    setupTournamentStructure(finalOrder);
    renderTournament();
});

// --- 3. INTERACTIVE DASHBOARD LOGIC ---
function toggleAdv(r, m, pNum) {
    const match = tournamentRounds[r][m];
    const p = pNum === 1 ? match.p1 : match.p2;
    if (p === "TBD" || p === "BYE") return;

    if (match.winner === p) {
        clearRes(r, m);
    } else {
        match.winner = p;
        if (r < tournamentRounds.length - 1) {
            const nextR = tournamentRounds[r+1], nextM = Math.floor(m / 2);
            if (r === tournamentRounds.length - 2) nextR[0].p1 = p;
            else if (m % 2 === 0) nextR[nextM].p1 = p; 
            else nextR[nextM].p2 = p;
        }
    }
    renderTournament();
}

function clearRes(r, m) {
    const match = tournamentRounds[r][m], prevW = match.winner;
    match.winner = null;
    if (r < tournamentRounds.length - 1) {
        const nextR = tournamentRounds[r+1], nextM = Math.floor(m / 2);
        if (r === tournamentRounds.length - 2) { 
            if (nextR[0].p1 === prevW) nextR[0].p1 = "TBD"; 
        } else {
            const slot = (m % 2 === 0) ? 'p1' : 'p2';
            if (nextR[nextM][slot] === prevW) { 
                nextR[nextM][slot] = "TBD"; 
                if (nextR[nextM].winner === prevW) clearRes(r + 1, nextM); 
            }
        }
    }
    renderTournament();
}

// --- 4. RENDER UI ---
function renderTournament() {
    const container = document.getElementById('bracketContainer');
    container.innerHTML = "";
    tournamentRounds.forEach((round, rIndex) => {
        const col = document.createElement('div');
        col.className = "round-column";
        
        const title = document.createElement('div');
        title.className = "round-title";
        title.innerText = rIndex === tournamentRounds.length - 1 ? "Champion" : `Round ${rIndex + 1}`;
        col.appendChild(title);

        round.forEach((match, mIndex) => {
            const box = document.createElement('div');
            box.className = "match-box";
            const content = document.createElement('div');
            content.className = "match-content";

            if (rIndex === tournamentRounds.length - 1) {
                // Champion Box (Includes Seed Formatting)
                content.innerHTML = `<div class="champion-box" onclick="clearRes(${rIndex}, ${mIndex})">
                    ${match.p1 === 'TBD' ? '???' : '🏆 ' + formatPlayerDisplay(match.p1)}
                </div>`;
            } else {
                // Match Box (Includes Bold Seeds and Brackets)
                content.innerHTML = `
                    <div class="player-row ${match.winner === match.p1 ? 'winner-highlight' : ''}" onclick="toggleAdv(${rIndex}, ${mIndex}, 1)">
                        <span>${formatPlayerDisplay(match.p1)}</span>
                        <input type="text" class="score-input" value="${match.s1 || ''}" onclick="event.stopPropagation()">
                    </div>
                    <div class="vs-divider">VS</div>
                    <div class="player-row ${match.winner === match.p2 ? 'winner-highlight' : ''}" onclick="toggleAdv(${rIndex}, ${mIndex}, 2)">
                        <span>${formatPlayerDisplay(match.p2)}</span>
                        <input type="text" class="score-input" value="${match.s2 || ''}" onclick="event.stopPropagation()">
                    </div>`;
            }
            box.appendChild(content); 
            col.appendChild(box);
        });
        container.appendChild(col);
    });
}

// --- 5. ROBUST PORTRAIT PDF EXPORT ---
document.getElementById('downloadBtn').addEventListener('click', async function() {
    const tournamentName = document.getElementById('displayTitle').innerText || "BITS Tournament";
    const appBody = document.getElementById('appBody');
    const pdfWrapper = document.getElementById('pdfWrapper');
    const overlay = document.getElementById('loadingOverlay');

    overlay.style.display = "flex";
    pdfWrapper.innerHTML = "";
    
    const originalBracket = document.getElementById('bracketContainer');
    const r1Matches = Array.from(originalBracket.querySelectorAll('.round-column:first-child .match-box'));
    const totalPages = Math.ceil(r1Matches.length / 8);

    for (let p = 0; p < totalPages; p++) {
        const page = document.createElement('div');
        page.className = 'pdf-page';
        page.innerHTML = `<div class="pdf-header">${tournamentName}</div>`;
        
        const layout = document.createElement('div');
        layout.className = 'main-bracket-layout';
        
        const columns = originalBracket.querySelectorAll('.round-column');
        columns.forEach((col) => {
            const isChampionCol = col.querySelector('.champion-box') !== null;
            if (isChampionCol) return; // Always exclude champion from PDF

            const colClone = document.createElement('div');
            colClone.className = "round-column";
            const matches = Array.from(col.querySelectorAll('.match-box'));
            
            // Slice matches to fit exactly 8 per page
            const ratio = Math.pow(2, Array.from(columns).indexOf(col));
            const start = Math.floor((p * 8) / ratio);
            const end = Math.floor(((p + 1) * 8) / ratio);
            
            matches.slice(start, end).forEach(m => {
                const mClone = m.cloneNode(true);
                mClone.querySelectorAll('span').forEach(s => {
                    // Replace TBD/??? with print-friendly lines
                    if (s.innerText.trim() === "TBD" || s.innerText.trim() === "???") {
                        s.className = "pdf-blank";
                    }
                });
                colClone.appendChild(mClone);
            });
            layout.appendChild(colClone);
        });

        page.appendChild(layout);
        page.innerHTML += `<div class="pdf-footer">Page ${p + 1} of ${totalPages}</div>`;
        pdfWrapper.appendChild(page);

        // Inject page break for multi-page draws
        if (p < totalPages - 1) {
            const breakDiv = document.createElement('div');
            breakDiv.className = 'html2pdf__page-break';
            pdfWrapper.appendChild(breakDiv);
        }
    }

    // Temporary UI Swap for reliable capture
    appBody.style.display = "none";
    pdfWrapper.style.display = "block";
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));

    const opt = {
        margin: 0,
        filename: `${tournamentName.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'px', format: [794, 1122], orientation: 'portrait' }
    };

    html2pdf().set(opt).from(pdfWrapper).save().then(() => {
        pdfWrapper.style.display = "none";
        appBody.style.display = "flex";
        overlay.style.display = "none";
    });
});

// --- 6. SEEDING & STRUCTURE LOGIC ---
function generateInvertedSeeding(seeded, unseeded, nSeeds, n) {
    let randomPool = [...unseeded];
    while ((seeded.length + randomPool.length) < n) randomPool.push("BYE");
    
    // Shuffle unseeded pool
    for (let i = randomPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [randomPool[i], randomPool[j]] = [randomPool[j], randomPool[i]];
    }

    // Standard Tournament Seeding Order
    let seeds = [1, 2];
    while (seeds.length < n) {
        let next = [];
        for (let s of seeds) { 
            next.push(s); 
            next.push(seeds.length * 2 + 1 - s); 
        }
        seeds = next;
    }

    const qSize = n / 4;
    const tennisOrder = [
        ...seeds.slice(0, qSize), 
        ...seeds.slice(qSize, qSize * 2).reverse(), 
        ...seeds.slice(qSize * 3), 
        ...seeds.slice(qSize * 2, qSize * 3).reverse()
    ];

    let poolIdx = 0;
    return tennisOrder.map(rank => (rank <= nSeeds ? seeded[rank-1] : randomPool[poolIdx++]));
}

function setupTournamentStructure(list) {
    tournamentRounds = [];
    let r1 = [];
    for(let i=0; i<list.length; i+=2) {
        r1.push({p1: list[i], p2: list[i+1], winner: null, s1: "", s2: ""});
    }
    tournamentRounds.push(r1);
    
    let count = r1.length;
    while(count > 1) {
        count /= 2;
        let nr = [];
        for(let i=0; i<count; i++) {
            nr.push({p1: "TBD", p2: "TBD", winner: null, s1: "", s2: ""});
        }
        tournamentRounds.push(nr);
    }
    tournamentRounds.push([{p1: "TBD", winner: null}]);
}
