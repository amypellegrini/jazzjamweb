#!/usr/bin/env python3
"""Generate the block-chords article examples: MusicXML -> SVG + MP3 via MuseScore 4."""
import re, sys
STEP={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
def pitch(n):
    m=re.fullmatch(r'([A-G])(b|#)?(\d)',n); s,a,o=m.groups()
    alt={'b':-1,'#':1,None:0}[a]
    return f"<pitch><step>{s}</step>{f'<alter>{alt}</alter>' if alt else ''}<octave>{o}</octave></pitch>"
def acc(n):
    a = 'flat' if 'b' in n[1:] else 'sharp' if '#' in n else None
    return a
TYPES={1:'eighth',2:'quarter',3:'quarter',4:'half',6:'half',8:'whole'}
# Passing tones: any melody note outside the C6 chord tones. Their whole block (both hands)
# is painted in PASSING_COLOR so the harmonised passing tones stand out in the notation.
CHORD_TONES = {'C', 'E', 'G', 'A'}
PASSING_COLOR = '#2563EB'
def is_passing(rh): return rh[0][:-1] not in CHORD_TONES
def notes(chord,dur,staff,voice,color=None):
    if not chord:  # empty hand: a rest for the duration
        return f"<note><rest/><duration>{dur}</duration><voice>{voice}</voice><type>{TYPES[dur]}</type><staff>{staff}</staff></note>"
    colors = color if isinstance(color, list) else [color] * len(chord)
    out=[]
    for i,n in enumerate(chord):
        color = colors[i]
        dot='<dot/>' if dur in (3,6) else ''
        out.append(f"<note{f' color=\"{color}\"' if color else ''}>{'<chord/>' if i else ''}{pitch(n)}<duration>{dur}</duration><voice>{voice}</voice><type>{TYPES[dur]}</type>{dot}<staff>{staff}</staff></note>")
    return ''.join(out)
def harmony(sym):
    if not sym: return ''
    m=re.fullmatch(r'([A-G])(b|#)?(.*)',sym); r,a,k=m.groups()
    kind={'6':('major-sixth','6'),'dim7':('diminished-seventh','o7'),'maj9':('major-ninth','maj9'),'m7':('minor-seventh','m7'),'':('major','')}[k]
    alt={'b':-1,'#':1,None:0}[a]
    return f"<harmony><root><root-step>{r}</root-step>{f'<root-alter>{alt}</root-alter>' if alt else ''}</root><kind text=\"{kind[1]}\">{kind[0]}</kind></harmony>"
def o(c): return c[4] if len(c) > 4 else {}  # optional per-chord overrides
def default_color(rh): return PASSING_COLOR if is_passing(rh) else None
def label(opts):
    """Optional coloured text under the score, e.g. a step in a build-up sequence."""
    if 'text' not in opts: return ''
    words, color = opts['text']
    # Below the left-hand staff: clear of chord symbols, so the steps line up on one baseline.
    return (f'<direction placement="below"><direction-type><words color="{color}" font-weight="bold">'
            f'{words}</words></direction-type><staff>2</staff></direction>')
def build(title, measures):
    # measures: list of list of (dur, symbol, rh_notes(top first), lh_notes[, overrides])
    # overrides: {'rh': colour or per-note colours, 'lh': colour, 'text': (words, colour)}
    body=[]
    for mi,meas in enumerate(measures,1):
        attrs = "<attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number=\"1\"><sign>G</sign><line>2</line></clef><clef number=\"2\"><sign>G</sign><line>2</line></clef></attributes>" if mi==1 else ''
        rh=''.join(label(o(c))+harmony(c[1])+notes(c[2],c[0],1,1,o(c).get('rh',default_color(c[2]))) for c in meas)
        tot=sum(c[0] for c in meas)
        lh=''.join(notes(c[3],c[0],2,5,o(c).get('lh',default_color(c[2]))) for c in meas)
        bar='<barline location="right"><bar-style>light-heavy</bar-style></barline>' if mi==len(measures) else ''
        body.append(f'<measure number="{mi}">{attrs}{tempo if mi==1 else ""}{rh}<backup><duration>{tot}</duration></backup>{lh}{bar}</measure>')
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
<part-list><score-part id="P1"><part-name print-object="no">Piano</part-name></score-part></part-list>
<part id="P1">{''.join(body)}</part></score-partwise>'''
BPM = 92
tempo = f"<direction placement=\"above\"><direction-type><words/></direction-type><sound tempo=\"{BPM}\"/></direction>"
def oct_down(n): return n[:-1]+str(int(n[-1])-1)
def blk(d,sym,rh): return (d,sym,rh,[oct_down(rh[0])])
E={}
# Build-up steps, colour-coded: melody, then the chord tones beneath it, then the doubling.
MELODY, CHORD, DOUBLE = '#C2255C', '#2F9E44', '#7048E8'
E['basic-shape']=("The basic shape",[
 [(8,None,['C5'],[], {'rh':[MELODY], 'text':('1. Melody', MELODY)})],
 [(8,'C6',['C5','A4','G4','E4'],[], {'rh':[MELODY,CHORD,CHORD,CHORD], 'text':('2. Chord tones below', CHORD)})],
 [(8,None,['C5','A4','G4','E4'],['C4'], {'rh':[MELODY,CHORD,CHORD,CHORD], 'lh':DOUBLE,
   'text':('3. Double in left hand', DOUBLE)})]])
E['diminished']=("Diminished",[[
 blk(1,'C6',['C5','A4','G4','E4']), blk(1,'Bdim7',['D5','B4','Ab4','F4']),
 blk(1,'C6',['E5','C5','A4','G4']), blk(1,'Bdim7',['F5','D5','B4','Ab4']),
 blk(1,'C6',['G5','E5','C5','A4']), blk(1,'Bdim7',['Ab5','F5','D5','B4']),
 blk(1,'C6',['A5','G5','E5','C5']), blk(1,'Bdim7',['B5','Ab5','F5','D5'])],
 [blk(8,'C6',['C6','A5','G5','E5'])]])
E['rootless-major-ninth']=("Rootless major ninth",[[
 blk(2,'C6',['C5','A4','G4','E4']), blk(2,'Cmaj9',['D5','B4','G4','E4']),
 blk(2,'C6',['E5','C5','A4','G4']), blk(2,None,['G5','E5','C5','A4'])],
 [blk(2,None,['A5','G5','E5','C5']), blk(2,'Cmaj9',['B5','G5','E5','D5']),
 blk(4,'C6',['C6','A5','G5','E5'])]])
E['minor-seventh']=("Minor seventh or major sixth",[[
 blk(1,'C6',['C5','A4','G4','E4']), blk(1,'Cmaj9',['D5','B4','G4','E4']),
 blk(1,'C6',['E5','C5','A4','G4']), blk(1,'F6',['F5','D5','C5','A4']),
 blk(1,'C6',['G5','E5','C5','A4']), blk(1,'Bdim7',['Ab5','F5','D5','B4']),
 blk(1,'C6',['A5','G5','E5','C5']), blk(1,'Cmaj9',['B5','G5','E5','D5'])],
 [blk(8,'C6',['C6','A5','G5','E5'])]])
E['chromatic']=("Chromatic",[[
 blk(1,'C6',['C5','A4','G4','E4']), blk(1,'Cmaj9',['D5','B4','G4','E4']),
 blk(1,'C6',['E5','C5','A4','G4']), blk(1,'F6',['F5','D5','C5','A4']),
 blk(1,'C6',['G5','E5','C5','A4']), blk(1,'Abm7',['Ab5','Gb5','Eb5','Cb5']),
 blk(1,'Am7',['A5','G5','E5','C5']), blk(1,'B6',['B5','G#5','F#5','D#5'])],
 [blk(8,'C6',['C6','A5','G5','E5'])]])

# Render: MusicXML source -> SVG (notation) + MP3 (playback) with MuseScore 4's CLI.
import os, subprocess, glob
MSCORE = os.environ.get("MSCORE", "/Applications/MuseScore 4.app/Contents/MacOS/mscore")
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "assets", "articles", "block-chords")
os.makedirs(OUT, exist_ok=True)
def write_cursor(k, measures):
    """Chord timings (from the score durations) + x positions (from the SVG's right-hand
    noteheads: every chord has a right hand, while the left hand may rest). A chord with a
    second displaces one head sideways, so heads are clustered per chord and the cluster's
    cursor sits at the cluster's centre."""
    import json
    svg = open(os.path.join(OUT, f"{k}.svg")).read()
    width = float(re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg).group(1))
    # Each notehead path starts at its left edge; centre the cursor on it (heads are ~107 units wide).
    heads = [(float(x) + 54, float(y)) for x, y in re.findall(r'class="Note"[^>]*? d="M([\d.]+),([\d.]+)', svg)]
    mid = (min(y for _, y in heads) + max(y for _, y in heads)) / 2
    rh = sorted(x for x, y in heads if y < mid)  # right-hand staff sits above the midpoint
    xs = []
    for x in rh:
        if not xs or x - xs[-1][-1] > 200: xs.append([x])
        else: xs[-1].append(x)
    xs = [(c[0] + c[-1]) / 2 for c in xs]  # centre of the chord, displaced heads included
    chords = [c for meas in measures for c in meas]
    assert len(xs) == len(chords), (k, len(xs), len(chords))
    eighth = 60 / BPM / 2
    t, events = 0.0, []
    for (d, *_rest), x in zip(chords, xs):
        events.append({"t": round(t, 3), "end": round(t + d * eighth, 3), "x": round(x / width * 100, 2)})
        t += d * eighth
    json.dump(events, open(os.path.join(OUT, f"{k}.cursor.json"), "w"))

if __name__ == "__main__":  # importable by scripts/video for its own snippets
    for k, (t, m) in E.items():
        src = os.path.join(OUT, f"{k}.musicxml")
        open(src, "w").write(build(t, m))
        for ext in ("svg", "mp3"):
            subprocess.run([MSCORE, "-o", os.path.join(OUT, f"{k}.{ext}"), "-T", "10", src],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        # MuseScore suffixes page numbers on SVG output; examples are one page each.
        os.replace(os.path.join(OUT, f"{k}-1.svg"), os.path.join(OUT, f"{k}.svg"))
        write_cursor(k, m)
        print("rendered", k)
