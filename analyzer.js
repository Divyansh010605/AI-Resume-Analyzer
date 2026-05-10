document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const filePreview = document.getElementById('file-preview');
    const fpName = document.getElementById('fp-name');
    const fpSize = document.getElementById('fp-size');
    const removeFileBtn = document.getElementById('remove-file');
    const analyzeBtn = document.getElementById('analyze-btn');
    const processing = document.getElementById('processing');
    const resultsSection = document.getElementById('results-section');
    const jobDescInput = document.getElementById('job-description');
    const industrySelect = document.getElementById('industry-select');

    let currentFile = null;
    let extractedText = '';

    // File Drag and Drop
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    removeFileBtn.addEventListener('click', () => {
        currentFile = null;
        extractedText = '';
        fileInput.value = '';
        dropZone.classList.remove('hidden');
        filePreview.classList.add('hidden');
        analyzeBtn.disabled = true;
    });

    function handleFile(file) {
        const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'];
        if (!validTypes.includes(file.type) && !file.name.endsWith('.docx') && !file.name.endsWith('.txt')) {
            alert('Please upload a PDF, DOCX, or TXT file.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert('File size must be less than 10MB.');
            return;
        }

        currentFile = file;
        fpName.textContent = file.name;
        fpSize.textContent = (file.size / 1024).toFixed(1) + ' KB';
        
        dropZone.classList.add('hidden');
        filePreview.classList.remove('hidden');
        analyzeBtn.disabled = false;
        
        extractText(file);
    }

    async function extractText(file) {
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
            extractedText = await extractPdfText(file);
        } else if (file.name.endsWith('.docx')) {
            extractedText = await extractDocxText(file);
        } else {
            extractedText = await file.text();
        }
    }

    async function extractPdfText(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
        }
        return text;
    }

    async function extractDocxText(file) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    }

    analyzeBtn.addEventListener('click', async () => {
        if (!extractedText) {
            alert("Please wait for file to be processed or upload a valid text document.");
            return;
        }

        // UI State: Processing
        analyzeBtn.disabled = true;
        processing.classList.remove('hidden');
        resultsSection.classList.add('hidden');
        
        // Simulating step animations for UI
        const steps = document.querySelectorAll('.ps');
        let currentStep = 0;
        const stepInterval = setInterval(() => {
            if (currentStep < steps.length - 1) {
                steps[currentStep].classList.remove('active');
                currentStep++;
                steps[currentStep].classList.add('active');
            }
        }, 1500);

        try {
            const response = await fetch('http://localhost:3000/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resumeText: extractedText,
                    jobDescription: jobDescInput.value,
                    industry: industrySelect.value
                })
            });

            clearInterval(stepInterval);
            steps.forEach(s => s.classList.remove('active'));
            steps[steps.length-1].classList.add('active');

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Analysis failed');
            }

            const data = await response.json();
            renderResults(data);

        } catch (error) {
            clearInterval(stepInterval);
            steps.forEach(s => s.classList.remove('active'));
            console.error(error);
            alert("Error: " + error.message + "\nIf this persists, check the console or ensure your API keys are correct.");
        } finally {
            processing.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    });

    function renderResults(data) {
        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth' });

        // Overall Score
        document.getElementById('ring-num').textContent = data.overallScore;
        const offset = 314 - (314 * data.overallScore) / 100;
        document.getElementById('ring-fg').style.strokeDashoffset = offset;
        document.getElementById('grade-circle').textContent = data.grade;
        document.getElementById('oc-title').textContent = data.overallScore >= 80 ? "Excellent Resume" : data.overallScore >= 60 ? "Good, but needs work" : "Needs significant improvement";
        document.getElementById('oc-desc').textContent = data.summary;

        // Quick Stats
        document.getElementById('ats-score-badge').textContent = data.atsScore || 0;
        document.getElementById('skills-match-badge').textContent = data.skillsMatch || 0;
        document.getElementById('impact-score-badge').textContent = data.quantification?.score || 0;
        document.getElementById('industry-result').innerHTML = `<strong>${data.detectedIndustry || 'Unknown'}</strong><br><span style="font-size:0.8rem; opacity:0.8">${data.detectedRole || 'General'}</span>`;

        // ATS Details
        const atsDetails = data.atsDetails || [];
        const atsHtml = atsDetails.length ? atsDetails.map(d => `
            <div class="ats-item ${d.status?.toLowerCase() === 'pass' ? 'pass' : d.status?.toLowerCase() === 'warning' ? 'warn' : 'fail'}">
                <div class="ats-info"><h4>${d.criterion || 'Check'}</h4><p>${d.comment || ''}</p></div>
            </div>
        `).join('') : '<p>No ATS details provided.</p>';
        document.getElementById('ats-grid').innerHTML = atsHtml;

        // Keywords
        const missing = data.missingKeywords || [];
        const present = data.presentKeywords || [];
        document.getElementById('keywords-container').innerHTML = `
            <div class="kw-group"><h4>Missing Keywords</h4>
            <div class="kw-list">${missing.length ? missing.map(k => `<span class="kw-tag missing">${k}</span>`).join('') : '<span class="kw-tag">None detected</span>'}</div></div>
            <div class="kw-group"><h4>Present Keywords</h4>
            <div class="kw-list">${present.length ? present.map(k => `<span class="kw-tag present">${k}</span>`).join('') : '<span class="kw-tag">None detected</span>'}</div></div>
        `;

        // Section Scores
        const secScores = data.sectionScores || { summary:0, experience:0, education:0, skills:0 };
        document.getElementById('sections-grid').innerHTML = Object.keys(secScores).map(k => `
            <div class="sec-score-card">
                <div class="val">${secScores[k]}</div>
                <div>${k.charAt(0).toUpperCase() + k.slice(1)}</div>
            </div>
        `).join('');

        // Writing
        const writing = data.writingQuality || [];
        document.getElementById('writing-grid').innerHTML = writing.length ? writing.map(w => `
            <div class="ats-item ${w.score > 7 ? 'pass' : 'warn'}">
                <div class="ats-info"><h4>${w.aspect || 'Aspect'} (${w.score || 0}/10)</h4><p>${w.feedback || ''}</p></div>
            </div>
        `).join('') : '<p>No writing feedback provided.</p>';

        // Impact
        document.getElementById('impact-container').innerHTML = `<p>${data.quantification?.feedback || 'No impact analysis available.'}</p>`;

        // Suggestions
        const suggestions = data.suggestions || [];
        document.getElementById('sugg-count').textContent = suggestions.length;
        document.getElementById('suggestions-container').innerHTML = suggestions.length ? suggestions.map(s => `
            <div class="sugg-item">
                <span class="sugg-pri ${(s.priority || '').toLowerCase() === 'high' ? 'high' : (s.priority || '').toLowerCase() === 'medium' ? 'med' : 'low'}">${s.priority || 'Tip'}</span>
                <div class="sugg-text">${s.text || ''}</div>
            </div>
        `).join('') : '<p>No suggestions.</p>';

        // Red Flags
        const redFlags = data.redFlags || [];
        if (redFlags.length > 0) {
            document.getElementById('red-flags-card').classList.remove('hidden');
            document.getElementById('red-flags-container').innerHTML = redFlags.map(r => `
                <div class="rf-item"><h4>${r.issue || 'Issue'}</h4><p>${r.description || ''}</p></div>
            `).join('');
        } else {
            document.getElementById('red-flags-card').classList.add('hidden');
        }

        // Highlights
        const highlights = data.highlights || [];
        document.getElementById('highlights-container').innerHTML = highlights.length ? highlights.map(h => `
            <div class="hl-item"><h4>${h.point || 'Strength'}</h4><p>${h.description || ''}</p></div>
        `).join('') : '<p>No highlights.</p>';

        // Re-initialize Lucide icons for any dynamically added icons if needed
        if (window.lucide) {
            lucide.createIcons();
        }
        
        // Hide top sections to make report full-page
        document.getElementById('hero').classList.add('hidden');
        document.getElementById('upload-section').classList.add('hidden');
        document.getElementById('features-section').classList.add('hidden');
        
        // Scroll to the very top to see the report from the beginning
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.getElementById('new-analysis-btn').addEventListener('click', () => {
        // Show top sections again
        document.getElementById('hero').classList.remove('hidden');
        document.getElementById('upload-section').classList.remove('hidden');
        document.getElementById('features-section').classList.remove('hidden');
        
        // Hide results
        resultsSection.classList.add('hidden');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => removeFileBtn.click(), 500);
    });

    document.getElementById('print-report-btn').addEventListener('click', () => {
        window.print();
    });
});
