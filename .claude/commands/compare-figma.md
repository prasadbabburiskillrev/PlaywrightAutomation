---
description: Compare a Figma frame against a code file (always fresh fetch, no caching), list diffs, wait for approval
---

Parse $ARGUMENTS for:
- figma: <Figma frame URL with node-id>
- file: <code file path>
- title: <optional — new title text to check/update in the comparison>
- rules: <optional — additional comparison rules for this run only>

## Step 1: Fetch Figma data
Always fetch fresh design data directly from Figma for this frame/node-id. 
Do not read from or write to any local cache file.

## Step 2: Compare
Read the target code file in full. Compare it against the Figma data.

Do NOT make any changes yet. List every difference — spacing, colors, 
typography, copy text, layout structure, component states.

If a `title` argument was passed, specifically check whether the title 
text in the code matches Figma's title text (and the new title passed 
in), and flag it as its own line item.

If a `rules` argument was passed, apply those rules in addition to the 
standing rules below for this run only.

## Standing rules (always apply)

1. Breakpoint fidelity: If the Figma frame is sized 1920x1080, the UI 
must match it 100% exactly at that resolution — no rounding, no 
"close enough" spacing/sizing. For any other screen size/breakpoint 
not covered by this frame, standard responsive UX judgment applies 
instead of exact matching.

2. Line-height units: Always keep line-height in the same unit Figma 
specifies (%), not px or unitless. Flag any place in the code where 
line-height uses a different unit than Figma, even if the rendered 
result looks visually similar.

3. <br> tags: Some <br> tags in the code exist specifically to match 
Figma's exact line breaks. Before flagging or removing any <br> tag, 
check whether removing it would change how the text wraps/breaks 
compared to the Figma design. If it would look the same without it, 
flag it as removable. If removing it would change the line break 
position, do NOT flag it for removal — note it as intentional and 
Figma-accurate.

## Output format

List differences as: 
[CATEGORY] Description | Figma value | Code value | File:line

Group by severity: VISUAL-ONLY first, then STRUCTURAL.

Only quote/reproduce code for MAJOR (structural) changes, and only the 
minimum lines needed to show the fix — not the whole function/block. 
For minor/visual-only changes, describe them in words with a 
file:line reference; do not paste code for those.

End with: "Reply with which numbers to apply, 'all', or 'none'."


All projects: ~/.claude/commands/compare-figma.md

One project only: <project-root>/.claude/commands/compare-figma.md