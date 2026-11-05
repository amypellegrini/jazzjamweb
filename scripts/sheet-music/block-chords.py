#!/usr/bin/env python3
"""Generate the block-chords article examples: MusicXML -> SVG + MP3 via MuseScore 4."""
import re, sys
STEP={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
def pitch(n):
    m=re.fullmatch(r'([A-G])(bb|b|#)?(\d)',n); s,a,o=m.groups()  # bb: double flat (Ebb, Gbb)
    alt={'bb':-2,'b':-1,'#':1,None:0}[a]
    return f"<pitch><step>{s}</step>{f'<alter>{alt}</alter>' if alt else ''}<octave>{o}</octave></pitch>"
def acc(n):
    a = 'flat' if 'b' in n[1:] else 'sharp' if '#' in n else None
    return a
TYPES={1:'eighth',2:'quarter',3:'quarter',4:'half',6:'half',8:'whole'}
# Passing tones: any melody note outside the C6 chord tones. Their whole block (both hands)
# is painted in PASSING_COLOR so the harmonised passing tones stand out in the notation.
CHORD_TONES = {'C', 'E', 'G', 'A'}
PASSING_COLOR = '#2563EB'
def is_passing(rh): return bool(rh) and rh[0][:-1] not in CHORD_TONES
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
    sym, _, bass = sym.partition('/')   # slash chord: "Bbm7/Ab" plays Bbm7 over A-flat
    m=re.fullmatch(r'([A-G])(b|#)?(.*)',sym); r,a,k=m.groups()
    if k == '7b9':  # dominant seventh with a flattened ninth
        alt={'b':-1,'#':1,None:0}[a]
        return (f"<harmony><root><root-step>{r}</root-step>{f'<root-alter>{alt}</root-alter>' if alt else ''}</root>"
                f"<kind text=\"7(b9)\">dominant</kind><degree><degree-value>9</degree-value><degree-alter>-1</degree-alter>"
                f"<degree-type>add</degree-type></degree></harmony>")
    kind={'6':('major-sixth','6'),'dim7':('diminished-seventh','o7'),'maj9':('major-ninth','maj9'),'m7':('minor-seventh','m7'),'7':('dominant','7'),'maj7':('major-seventh','maj7'),'m7b5':('half-diminished','m7b5'),'':('major','')}[k]
    alt={'b':-1,'#':1,None:0}[a]
    b=''
    if bass:
        bm=re.fullmatch(r'([A-G])(b|#)?',bass); balt={'b':-1,'#':1,None:0}[bm[2]]
        b=f"<bass><bass-step>{bm[1]}</bass-step>{f'<bass-alter>{balt}</bass-alter>' if balt else ''}</bass>"
    return f"<harmony><root><root-step>{r}</root-step>{f'<root-alter>{alt}</root-alter>' if alt else ''}</root><kind text=\"{kind[1]}\">{kind[0]}</kind>{b}</harmony>"
def o(c): return c[4] if len(c) > 4 else {}  # optional per-chord overrides
def default_color(rh): return PASSING_COLOR if is_passing(rh) else None
def label(opts, staff=2):
    """Optional coloured text under the score, e.g. a step in a build-up sequence."""
    if 'text' not in opts: return ''
    words, color = opts['text']
    # Below the lowest staff: clear of chord symbols, so the steps line up on one baseline.
    return (f'<direction placement="below"><direction-type><words color="{color}" font-weight="bold">'
            f'{words}</words></direction-type><staff>{staff}</staff></direction>')
def one_staff(measures): return all(not c[3] for meas in measures for c in meas)
def build(title, measures, lines=False, bass=False):
    # measures: list of list of (dur, symbol, rh_notes(top first), lh_notes[, overrides])
    # overrides: {'rh': colour or per-note colours, 'lh': colour, 'text': (words, colour)}
    # Right hand only (no left-hand note anywhere): one treble staff instead of the grand staff.
    single = one_staff(measures)
    staves = '<clef><sign>G</sign><line>2</line></clef>' if single else '<staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef>' + ('<clef number="2"><sign>F</sign><line>4</line></clef>' if bass else '<clef number="2"><sign>G</sign><line>2</line></clef>')
    body=[]
    for mi,meas in enumerate(measures,1):
        attrs = f"<attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time>{staves}</attributes>" if mi==1 else ''
        rh=''.join(label(o(c), 1 if single else 2)+harmony(c[1])+notes(c[2],c[0],1,1,o(c).get('rh',default_color(c[2]))) for c in meas)
        tot=sum(c[0] for c in meas)
        lh=''.join(notes(c[3],c[0],2,5,o(c).get('lh',default_color(c[2]))) for c in meas)
        brk='<print new-system="yes"/>' if lines and mi == 2 else ''  # exercises: the way up on its own line, then down + the final chord
        bar='<barline location="right"><bar-style>light-heavy</bar-style></barline>' if mi==len(measures) else ''
        hands = rh if single else f'{rh}<backup><duration>{tot}</duration></backup>{lh}'
        body.append(f'<measure number="{mi}">{brk}{attrs}{tempo if mi==1 else ""}{hands}{bar}</measure>')
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
 [(8,'C6',['C5'],[], {'rh':[MELODY], 'text':('1. Melody', MELODY)})],
 [(8,None,['C5','A4','G4','E4'],[], {'rh':[MELODY,CHORD,CHORD,CHORD], 'text':('2. Chord tones below', CHORD)})],
 # One treble staff: the left-hand doubling (C4) sits on a ledger line under the right hand.
 [(8,None,['C5','A4','G4','E4','C4'],[], {'rh':[MELODY,CHORD,CHORD,CHORD,DOUBLE],
   'text':('3. Double in left hand', DOUBLE)})]])
# The same block built from the bottom up: the left-hand root, the chord tones stacked above it,
# then the melody doubled on top. Same colours as the basic shape, so the two read as one block.
E['basic-shape-from-below']=("The basic shape, from below",[
 [(8,'C6',['C4'],[], {'rh':[DOUBLE], 'text':('1. Root in left hand', DOUBLE)})],
 [(8,None,['A4','G4','E4','C4'],[], {'rh':[CHORD,CHORD,CHORD,DOUBLE], 'text':('2. Chord tones above', CHORD)})],
 [(8,None,['C5','A4','G4','E4','C4'],[], {'rh':[MELODY,CHORD,CHORD,CHORD,DOUBLE],
   'text':('3. Melody on top', MELODY)})]])
# Exercise: the C6 block in each of its positions, the melody on C, E, G and A, up to the top C and
# back down, one block per beat. Plain black, chord symbol on the first block only.
PLAIN = {'rh': [None] * 4, 'lh': None}
def ex_blk(sym, rh, d=2): return (d, sym, rh, [oct_down(rh[0])], PLAIN)
C6_POS = {'C': ['C5','A4','G4','E4'], 'E': ['E5','C5','A4','G4'], 'G': ['G5','E5','C5','A4'],
          'A': ['A5','G5','E5','C5'], "C'": ['C6','A5','G5','E5']}
E['c6-positions']=("C6 in every position",[
 [ex_blk('C6', C6_POS['C'])] + [ex_blk(None, C6_POS[n]) for n in 'EGA'],
 [ex_blk(None, C6_POS[n]) for n in ["C'", 'A', 'G', 'E']],
 [ex_blk(None, C6_POS['C'], 8)]])
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
E['dominant-seventh']=("Dominant seventh",[[
 blk(1,'C6',['C5','A4','G4','E4']), blk(1,'Cmaj9',['D5','B4','G4','E4']),
 blk(1,'C6',['E5','C5','A4','G4']), blk(1,'G7',['F5','D5','B4','G4']),
 blk(1,'C6',['G5','E5','C5','A4']), blk(1,'Bdim7',['Ab5','F5','D5','B4']),
 blk(1,'C6',['A5','G5','E5','C5']), blk(1,'Cmaj9',['B5','G5','E5','D5'])],
 [blk(8,'C6',['C6','A5','G5','E5'])]])
E['chromatic']=("Chromatic",[[
 blk(1,'C6',['C5','A4','G4','E4']), blk(1,'Cmaj9',['D5','B4','G4','E4']),
 blk(1,'C6',['E5','C5','A4','G4']), blk(1,'G7',['F5','D5','B4','G4']),
 blk(1,'C6',['G5','E5','C5','A4']), blk(1,'G#m7',['G#5','F#5','D#5','B4']),
 blk(1,'Am7',['A5','G5','E5','C5']), blk(1,'B6',['B5','G#5','F#5','D#5'])],
 [blk(8,'C6',['C6','A5','G5','E5'])]])

# 2 5 1: chord tones C, E, G on C6 (the I); the 2nd, 4th and 7th degrees (D, F, B) on G7, the
# dominant of the 5th degree; the 6th degree (A) on Dm7, the ii. Each inverted to put the melody on
# top. Here A is a passing tone too, so its Dm7 block is marked like the others. The bebop
# scale's A-flat stays a diminished passing tone (B°7), as in the sixth-diminished scale.
def p_blk(d, sym, rh): return blk(d, sym, rh) + ({'rh': [PASSING_COLOR] * 4, 'lh': PASSING_COLOR},)
E['two-five-one']=("2 5 1 passing tones",[[
 blk(1,'C6',['C5','A4','G4','E4']), blk(1,'G7',['D5','B4','G4','F4']),
 blk(1,'C6',['E5','C5','A4','G4']), blk(1,'G7',['F5','D5','B4','G4']),
 blk(1,'C6',['G5','E5','C5','A4']), blk(1,'Bdim7',['Ab5','F5','D5','B4']),
 p_blk(1,'Dm7',['A5','F5','D5','C5']), blk(1,'G7',['B5','G5','F5','D5'])],
 [blk(8,'C6',['C6','A5','G5','E5'])]])

# Block voicings by melody note (right hand top-first; the left hand doubles the top note).
V = {
 'C': ['C5','A4','G4','E4'], "C'": ['C6','A5','G5','E5'], 'E': ['E5','C5','A4','G4'],
 'G': ['G5','E5','C5','A4'], 'A': ['A5','G5','E5','C5'],
 'D.maj9': ['D5','B4','G4','E4'], 'B.maj9': ['B5','G5','E5','D5'],
 'D.dim': ['D5','B4','Ab4','F4'], 'F.dim': ['F5','D5','B4','Ab4'], 'Ab.dim': ['Ab5','F5','D5','B4'], 'B.dim': ['B5','Ab5','F5','D5'],
 'D.G7': ['D5','B4','G4','F4'], 'F.G7': ['F5','D5','B4','G4'], 'B.G7': ['B5','G5','F5','D5'], 'A.Dm7': ['A5','F5','D5','C5'],
 'Ab.m7': ['Ab5','Gb5','Eb5','Cb5'], 'G#.m7': ['G#5','F#5','D#5','B4'], 'B.6': ['B5','G#5','F#5','D#5'], 'Ab.Bbm7': ['Ab5','F5','Db5','Bb4'], 'F.Bbm7': ['F5','Db5','Bb4','Ab4'],
}
def run(steps, dur):
    """Blocks for a list of (voicing, chord symbol) steps, each `dur` eighths long."""
    return [blk(dur, sym, V[v]) if not v.startswith('A.Dm7') else p_blk(dur, sym, V[v]) for v, sym in steps]
def bars_of(blocks):
    out, cur, used = [], [], 0
    for b in blocks:
        if used + b[0] > 8: out.append(cur); cur, used = [], 0
        cur.append(b); used += b[0]
    return out + [cur] if cur else out

# Chromatic, descending: B no longer approaches anything by a half step, so it falls back to the
# rootless Cmaj9; A-flat now approaches G from above, so it takes G's voicing (C6 over its fifth,
# read as Am7/G) a half step higher: Bbm7/Ab. Likewise F approaches E from above, so it takes E's
# voicing (C6 over E, read as Am7/E) a half step higher: Bbm7/F.
CHROM_DOWN = [("C'",'C6'), ('B.maj9','Cmaj9'), ('A','C6'), ('Ab.Bbm7','Bbm7/Ab'),
              ('G','Am7/G'), ('F.Bbm7','Bbm7/F'), ('E','Am7/E'), ('D.maj9','Cmaj9')]
E['chromatic-descending']=("Chromatic, descending", bars_of(run(CHROM_DOWN, 1)) + [[blk(8,'C6',V['C'])]])

# Detail figures: the chords the text spells out or compares, shown side by side, half or whole
# notes. Spelled chords (no melody) sit in the right hand alone; blocks keep the left-hand doubling.
BLACK, BLUE = {'rh': None, 'lh': None}, {'rh': PASSING_COLOR, 'lh': PASSING_COLOR}
def chord(d, sym, notes_, opts=BLACK): return (d, sym, notes_, [], opts)
# Barry Harris's sixth-diminished scale (the C major bebop scale), melody only: in eighth notes the
# C6 chord tones fall on the beat and the passing tones (blue) on the offbeats.
E['sixth-diminished-scale'] = ("The sixth-diminished scale", [
 [(1, 'C6' if n == 'C4' else None, [n], [], {'rh': PASSING_COLOR if is_passing([n]) else None})
  for n in ['C4','D4','E4','F4','G4','Ab4','A4','B4']], [chord(8, None, ['C5'])]])  # from middle C
# Building up: the whole scale in the left hand, an octave below where the melody will be, and the
# right hand adding the C6 block only on the chord tones (rests on the passing tones, in blue).
def lh_only(n): return (1, None, [], [n], {'lh': PASSING_COLOR})
E['scale-chord-tones'] = ("Scale in the left hand, C6 on the chord tones", [
 [(blk(1, 'C6' if n == 'C' else None, V[n]) + (BLACK,)) if n in V else lh_only(n + '4')
  for n in ['C','D','E','F','G','Ab','A','B']], [blk(8, None, V["C'"]) + (BLACK,)]])
# C6 (green, the chord-tone colour of the basic shape) against B°7 (blue) voiced from D4, the
# inversion closest to C6: each note sits a step from a C6 note. Then the scale, each note in the
# colour of the chord it belongs to.
GREEN = {'rh': CHORD, 'lh': CHORD}
E['detail-c6-bdim7'] = ("C6 and B°7", [
 [chord(8, 'C6', ['A4','G4','E4','C4'], GREEN)], [chord(8, 'Bdim7', ['B4','Ab4','F4','D4'], BLUE)],
 [chord(1, None, [n], BLUE if is_passing([n]) else GREEN) for n in ['C4','D4','E4','F4','G4','Ab4','A4','B4']]])
# Ascending from D4, each chord stacked from the next note up: D°7, F°7, A♭°7, B°7.
# G7(b9) resolving to C6: the B°7 notes (D-F-Ab-B) over a G bass are G7(b9) without its root,
# so the diminished chord resolves to C6 just as the dominant does. Grand staff, bass in F clef.
E['detail-g7b9-c6'] = ("G7(b9) to C6", [
 [(4, 'G7b9', ['B4','Ab4','F4','D4'], ['G2'], {'rh': PASSING_COLOR, 'lh': None}),
  (4, 'C6', ['C5','A4','G4','E4'], ['C3'], BLACK)]])
BASS_CLEF = {'detail-g7b9-c6'}  # grand staff with the left hand in F clef
# Ascending from D4, each chord stacked from the next note up and spelled as its own chord, in
# minor thirds from its root: D°7 D-F-Ab-Cb, F°7 F-Ab-Cb-Ebb, A♭°7 Ab-Cb-Ebb-Gbb, B°7 B-D-F-Ab.
E['detail-dim-names'] = ("Four names for one diminished chord", [
 [chord(4, 'Ddim7', ['Cb5','Ab4','F4','D4'], BLUE), chord(4, 'Fdim7', ['Ebb5','Cb5','Ab4','F4'], BLUE)],
 [chord(4, 'Abdim7', ['Gbb5','Ebb5','Cb5','Ab4'], BLUE), chord(4, 'Bdim7', ['Ab5','F5','D5','B4'], BLUE)]])
# Cmaj9 with its root (in red, for contrast), then without it: the rootless shape E-G-B-D.
ROOT_RED = '#E03131'
E['detail-rootless'] = ("Rootless major ninth", [
 [chord(4, 'Cmaj9', ['D5','B4','G4','E4','C4'], {'rh': [None] * 4 + [ROOT_RED], 'lh': None}), chord(4, 'Cmaj9', ['D5','B4','G4','E4'], {**BLUE, 'text': ('Rootless', PASSING_COLOR)})]])
# The two passing shapes spelled out on one treble staff: rootless Cmaj9 (E-G-B-D) and G7 with F on top and below (F-G-B-D-F).
E['detail-g7-maj9'] = ("Rootless Cmaj9 and G7", [[chord(4, 'Cmaj9', ['D5','B4','G4','E4'], BLUE), chord(4, 'G7', ['F5','D5','B4','G4','F4'], BLUE)]])
# Ascending, so the approach to A is spelled with sharps: G#m7, not Abm7.
E['detail-chromatic-up'] = ("Chromatic approaches from below", [
 [blk(4, 'G#m7', V['G#.m7']), blk(4, 'Am7', V['A'])], [blk(4, 'B6', V['B.6']), blk(4, 'C6', V["C'"])]])
E['detail-chromatic-down'] = ("Chromatic approaches from above", [
 [blk(4, 'Bbm7/Ab', V['Ab.Bbm7']), blk(4, 'Am7/G', V['G'])], [blk(4, 'Bbm7/F', V['F.Bbm7']), blk(4, 'Am7/E', V['E'])]])
E['detail-two-five-one-voicings'] = ("G7 and Dm7 inversions", [
 [blk(4, 'G7', V['D.G7']), blk(4, 'G7', V['F.G7'])], [blk(4, 'G7', V['B.G7']), p_blk(4, 'Dm7', V['A.Dm7'])]])
E['detail-two-five-one-cadence'] = ("A 2 5 1 at the top of the scale", [
 [p_blk(4, 'Dm7', V['A.Dm7']), blk(4, 'G7', V['B.G7'])], [blk(8, 'C6', V["C'"])]])

# Examples shown without the passing-tone highlight: blue becomes black, other colours stay.
def unhighlight(measures):
    def clear(col):
        if isinstance(col, list): return [None if x == PASSING_COLOR else x for x in col]
        return None if col == PASSING_COLOR else col
    return [[c[:4] + ({**o(c), 'rh': clear(o(c).get('rh')), 'lh': clear(o(c).get('lh'))},) for c in meas]
            for meas in measures]
for _k in ['scale-chord-tones', 'detail-g7b9-c6', 'detail-dim-names', 'detail-g7-maj9',
           'detail-chromatic-up', 'detail-chromatic-down', 'detail-two-five-one-voicings',
           'detail-two-five-one-cadence']:
    E[_k] = (E[_k][0], unhighlight(E[_k][1]))

# Exercises: each technique up the C bebop scale and back down, one block per eighth note.
def up_down(up, down):
    """Plain black, and only the opening C6 named: the voicings are explained in the text."""
    blocks = [(d, sym if i == 0 else None, rh, lh, PLAIN) for i, (d, sym, rh, lh, *_) in enumerate(run(up + down, 1))]
    return bars_of(blocks) + [[(8, None, V['C'], [oct_down(V['C'][0])], PLAIN)]]
DIM_UP = [('C','C6'),('D.dim','Bdim7'),('E','C6'),('F.dim','Bdim7'),('G','C6'),('Ab.dim','Bdim7'),('A','C6'),('B.dim','Bdim7')]
DIA_UP = [('C','C6'),('D.maj9','Cmaj9'),('E','C6'),('F.G7','G7'),('G','C6'),('Ab.dim','Bdim7'),('A','C6'),('B.maj9','Cmaj9')]
CHR_UP = [('C','C6'),('D.maj9','Cmaj9'),('E','C6'),('F.G7','G7'),('G','C6'),('G#.m7','G#m7'),('A','Am7'),('B.6','B6')]
TFO_UP = [('C','C6'),('D.G7','G7'),('E','C6'),('F.G7','G7'),('G','C6'),('Ab.dim','Bdim7'),('A.Dm7','Dm7'),('B.G7','G7')]
top = [("C'",'C6')]
desc = lambda up: top + list(reversed(up[1:]))   # same voicings as ascending, top C down to D
# Exercise: the left-hand scale with C6 on the chord tones (Example 4), up and back down.
# Plain black like the other exercises, chord symbol on the first block only.
def lh_step(n, first=False):
    if n in V: return blk(1, 'C6' if first else None, V[n]) + (PLAIN,)
    return (1, None, [], [n + ('5' if n == "C'" else '4')], PLAIN)
E['exercise-scale-chord-tones'] = ("Exercise: scale in the left hand", [
 [lh_step(n, i == 0) for i, n in enumerate(['C','D','E','F','G','Ab','A','B'])],
 [lh_step(n) for n in ["C'",'B','A','Ab','G','F','E','D']],
 [(8, None, V['C'], [oct_down(V['C'][0])], PLAIN)]])
E['exercise-diminished'] = ("Exercise: diminished", up_down(DIM_UP, desc(DIM_UP)))
E['exercise-diatonic']   = ("Exercise: diatonic",   up_down(DIA_UP, desc(DIA_UP)))
E['exercise-chromatic']  = ("Exercise: chromatic",  up_down(CHR_UP, CHROM_DOWN))
E['exercise-two-five-one'] = ("Exercise: 2 5 1",    up_down(TFO_UP, desc(TFO_UP)))

# Render: MusicXML source -> SVG (notation) + MP3 (playback) with MuseScore 4's CLI.
import os, subprocess, glob
# MSCORE overrides; otherwise the macOS app if present, else `mscore` on PATH (Linux/CI).
_MAC_MSCORE = "/Applications/MuseScore 4.app/Contents/MacOS/mscore"
MSCORE = os.environ.get("MSCORE") or (_MAC_MSCORE if os.path.exists(_MAC_MSCORE) else "mscore")
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "assets", "articles", "block-chords")
os.makedirs(OUT, exist_ok=True)
def write_cursor(k, measures):
    """Chord timings (from the score durations) + x positions (from the SVG's right-hand
    noteheads: every chord has a right hand, while the left hand may rest). The heads, in
    reading order, are dealt out to the chords by each chord's note count; a chord with a
    second displaces one head sideways, so the cursor sits at the centre of the chord's heads."""
    import json
    svg = open(os.path.join(OUT, f"{k}.svg")).read()
    width = float(re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg).group(1))
    # Each notehead path starts at its left edge; centre the cursor on it (heads are ~107 units wide).
    height = float(re.search(r'viewBox="0 0 [\d.]+ ([\d.]+)"', svg).group(1))
    heads = [(float(x) + 54, float(y)) for x, y in re.findall(r'class="Note"[^>]*? d="M([\d.]+),([\d.]+)', svg)]
    # Systems from the staff lines: five lines a staff, two staves (right hand, left hand) a system,
    # or a single treble staff when there is no left hand.
    lines = sorted({round(float(y), 1) for y in re.findall(r'class="StaffLines"[^>]*? points="[\d.]+,([\d.]+)', svg)})
    staves = [lines[i:i + 5] for i in range(0, len(lines), 5)]
    per = 1 if one_staff(measures) else 2
    systems = [(staves[i][0], staves[i][-1], staves[i + per - 1][0], staves[i + per - 1][-1]) for i in range(0, len(staves), per)]
    def system_of(y):  # nearest system, so heads on ledger lines still count
        return min(range(len(systems)), key=lambda i: abs((systems[i][0] + systems[i][3]) / 2 - y))
    rh, lh = [], []  # (system, x) of every right-/left-hand head, in reading order
    for i, (rh_top, rh_bot, lh_top, lh_bot) in enumerate(systems):
        rh += [(i, x) for x in sorted(x for x, y in heads if system_of(y) == i and (per == 1 or y < (rh_bot + lh_top) / 2))]
        lh += [(i, x) for x in sorted(x for x, y in heads if system_of(y) == i and per == 2 and y >= (rh_bot + lh_top) / 2)]
    chords = [c for meas in measures for c in meas]
    assert len(rh) == sum(len(c[2]) for c in chords), (k, len(rh), sum(len(c[2]) for c in chords))
    xs, n, m = [], 0, 0  # (system, chord centre x); a right-hand rest takes its left-hand heads
    for c in chords:
        group = rh[n:n + len(c[2])] if c[2] else lh[m:m + len(c[3])]
        n += len(c[2])
        if per == 2: m += len(c[3])
        assert len({i for i, _ in group}) == 1, (k, 'chord split across lines')
        xs.append((group[0][0], (group[0][1] + group[-1][1]) / 2))
    assert len(xs) == len(chords), (k, len(xs), len(chords))
    eighth = 60 / BPM / 2
    t, events = 0.0, []
    pad = 2 * (systems[0][1] - systems[0][0]) / 4  # two staff spaces above and below
    for (d, *_rest), (i, x) in zip(chords, xs):
        e = {"t": round(t, 3), "end": round(t + d * eighth, 3), "x": round(x / width * 100, 2)}
        if len(systems) > 1:  # vertical extent of the chord's own line
            e["top"] = round(max(0, systems[i][0] - pad) / height * 100, 2)
            e["bottom"] = round(min(height, systems[i][3] + pad) / height * 100, 2)
        events.append(e)
        t += d * eighth
    json.dump(events, open(os.path.join(OUT, f"{k}.cursor.json"), "w"))

only = set(sys.argv[1:])  # optional example keys: render just those
for k, (t, m) in E.items():
    if only and k not in only: continue
    src = os.path.join(OUT, f"{k}.musicxml")
    multi = k.startswith('exercise-')
    open(src, "w").write(build(t, m, lines=multi, bass=k in BASS_CLEF))
    # The exercises keep their lines close together (multi-line.mss; MuseScore ignores
    # layout settings in MusicXML).
    # Every style file turns chord-symbol playback off (base.mss holds just that).
    mss = "multi-line.mss" if multi else "detail.mss" if k.startswith("detail-") else "base.mss"
    style = ["-S", os.path.join(os.path.dirname(__file__), mss)]
    for ext in ("svg", "mp3"):
        subprocess.run([MSCORE, *style, "-o", os.path.join(OUT, f"{k}.{ext}"), "-T", "10", src],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    # MuseScore suffixes page numbers on SVG output; examples are one page each.
    os.replace(os.path.join(OUT, f"{k}-1.svg"), os.path.join(OUT, f"{k}.svg"))
    write_cursor(k, m)
    print("rendered", k)
