let vexNotes = [];
let octave = -1;
const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
let selectedNote = '';

for (i = 12; i <= 107; i++) {
    if ((i % 12) === 0) {
        octave++;
    }

    vexNotes.push({
        'octave': octave,
        'note': notes[(i % 12)],
        'midi': i,
        'vexNote': `${notes[(i % 12)]}/${octave}`,
    });
}

let correctNote = 60; // C4 por defecto
let audioContext = new (window.AudioContext || window.webkitAudioContext)();

function drawPianoRoll() {
    const container = document.getElementById('piano-roll');
    container.innerHTML = '';
    let htmlContent = '';
    vexNotes.forEach(function (note) {
        if (note.note.includes('#')) {
            htmlContent += `<div class="key black" data-note="${note.midi}"></div>`;
        } else {
            htmlContent += `<div class="key" data-note="${note.midi}"></div>`;
        }
    });

    container.innerHTML = htmlContent;
}

function drawStave(note, key = "treble") {
    const div = document.getElementById("output");
    div.innerHTML = ""; // Limpiar el pentagrama anterior

    const { Renderer, Stave, StaveNote, Accidental } = Vex.Flow;

    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(500, 200);
    const context = renderer.getContext();
    const stave = new Stave(10, 40, 400);
    stave.addClef(key).setContext(context).draw();


    const staveNote = new StaveNote({
        keys: [note], // Cambiar esto para diferentes notas
        duration: "q", // Nota negra
        clef: key
    });

    // Dibujar la nota
    if (note.includes('#')) {
        staveNote.addAccidental(0, new Accidental("#"));
    }

    const notes = [staveNote];


    const voice = new Vex.Flow.Voice({ num_beats: 1, beat_value: 4 });
    voice.addTickables(notes);
    const formatter = new Vex.Flow.Formatter().joinVoices([voice]).format([voice], 400);
    voice.draw(context, stave);
}

function getRandomNote() {
    const randomIndex = Math.floor(Math.random() * 40) + 40;
    correctNote = vexNotes[randomIndex].midi;
    selectedNote = vexNotes[randomIndex];
    return vexNotes[randomIndex].vexNote;
}

function getRandomClef() {
    return Math.random() < 0.5 ? 'bass' : 'treble';
}

function playNote(note) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = 'sine'; // Onda senoidal

    // Calcular frecuencia MIDI (A4 = 440 Hz)
    const frequency = 440 * Math.pow(2, (note - 69) / 12);
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Iniciar y detener el sonido
    oscillator.start();
    gainNode.gain.setValueAtTime(1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 2);
    oscillator.stop(audioContext.currentTime + 1.2);
}

// Inicializar pentagrama con una nota aleatoria

drawStave(getRandomNote(), getRandomClef());

async function connectMIDIDevice() {
    console.log('MIDI connected');
    // Verificar si el acceso MIDI ya fue concedido
    if (localStorage.getItem('midiPermissionGranted')) {
        navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    } else {
        navigator.requestMIDIAccess().then((access) => {
            localStorage.setItem('midiPermissionGranted', 'true');
            onMIDISuccess(access);
        }).catch(onMIDIFailure);
    }
}

function onMIDISuccess(midiAccess) {
    console.log('on MIDI success');
    console.log(midiAccess);
    const midiSelect = document.getElementById('midiSelect');
    midiSelect.innerHTML = ""; // Limpiar opciones anteriores

    // Llenar el <select> con dispositivos MIDI de entrada
    midiAccess.inputs.forEach((input) => {
        const option = document.createElement('option');
        option.value = input.id;
        option.textContent = input.name || `Dispositivo MIDI ${input.id}`;
        midiSelect.appendChild(option);
    });

    // Cambiar dispositivo MIDI cuando el usuario selecciona uno
    midiSelect.addEventListener('change', (event) => {
        const selectedDeviceId = event.target.value;
        selectMIDIDevice(midiAccess, selectedDeviceId);
    });

    // Seleccionar el primer dispositivo por defecto
    if (midiSelect.options.length > 0) {
        selectMIDIDevice(midiAccess, midiSelect.options[0].value);
    }
}

function onMIDIFailure() {
    alert("No se pudo acceder a dispositivos MIDI.");
}

function selectMIDIDevice(midiAccess, deviceId) {
    // Quitar listeners anteriores
    midiAccess.inputs.forEach((input) => {
        input.onmidimessage = null;
    });

    // Configurar el nuevo dispositivo seleccionado
    const selectedInput = midiAccess.inputs.get(deviceId);
    if (selectedInput) {
        selectedInput.onmidimessage = onMIDIMessage;
        console.log(`Dispositivo MIDI seleccionado: ${selectedInput.name}`);
    }
}

// Función para manejar eventos MIDI
function onMIDIMessage(message) {
    console.log('on MIDI message');
    const [command, note, velocity] = message.data;
    console.log(command,note,velocity);

    // Nota presionada
    if (command === 144 && velocity > 0) {
        checkNotePressed(note);
        playNote(note); // Lógica para reproducir sonido, si es necesario
    }
}

function checkNotePressed(note) {
    return note == selectedNote.midi;
}

// Llamar a la función principal al cargar
connectMIDIDevice();



drawPianoRoll();

// Simular señales MIDI desde el piano roll
const pianoRoll = document.getElementById('piano-roll');
pianoRoll.addEventListener('click', (event) => {
    const target = event.target;
    if (target.classList.contains('key')) {
        const note = parseInt(target.getAttribute('data-note'));
        target.classList.add('pressed');
        const correctElement = document.querySelector(`div[data-note="${selectedNote.midi}"]`);
        correctElement.classList.add('correct');
        playNote(note); // Reproducir sonido
        setTimeout(() => {
            target.classList.remove('pressed');
            correctElement.classList.remove('correct');
        }, 200);

        const resultElement = $('#text-result');
        if (checkNotePressed(note)) {
            resultElement.text("¡Correcto!");
            setTimeout(() => {
                resultElement.text("trata de adivinar la nota");
                drawStave(getRandomNote(), getRandomClef());
            }, 1000);
        } else {
            const fullCorrectNote = vexNotes.filter(vexNote => vexNote.midi == correctNote);
            resultElement.text("Incorrecto. La nota correcta era " + fullCorrectNote[0].vexNote);
        }

        // Simular señal MIDI soltando la tecla
        
    }
});

function generateGif(type) {
    const giphy = {
        baseURL: "https://api.giphy.com/v1/gifs/",
        apiKey: "0UTRbFtkMxAplrohufYco5IY74U8hOes",
        tag: type,
        type: "random",
        rating: "pg-13"
    };

    let giphyURL = encodeURI(
        giphy.baseURL +
        giphy.type +
        "?api_key=" +
        giphy.apiKey +
        "&tag=" +
        giphy.tag +
        "&rating=" +
        giphy.rating
    );

    $.getJSON(giphyURL, function (data) {
        $('#gif-wrap').attr('src', data.data.images["480w_still"].url)
        const resultText = $('#text-result');

        if (type == 'success') {
            resultText.text('perfe');
        } else if (type === 'fail') {
            resultText.text('Nope');
        } else {
            resultText.text('Intenta adivinar la nota');
        }
    });


}

jQuery(document).ready(function ($) {
    generateGif('waiting');
});