# UX comparison arena setup

The arena loads six prototypes from separate Git worktrees. From the root of a fresh clone in PowerShell, run:

```powershell
git fetch origin
git worktree add work/ux-variations/ux-impeccable -b ux-impeccable origin/ux-impeccable
git worktree add work/ux-variations/ux-pro-max -b ux-pro-max origin/ux-pro-max
git worktree add work/ux-variations/ux-taste-motion -b ux-taste-motion origin/ux-taste-motion
git worktree add work/ux-variations/ux-discovered-skills -b ux-discovered-skills origin/ux-discovered-skills
git worktree add work/ux-variations/ux-open-design-benchmark -b ux-open-design-benchmark origin/ux-open-design-benchmark
git worktree add work/ux-variations/ux-baseline-noskills -b ux-baseline-noskills origin/ux-baseline-noskills
```

Then open `outputs/ux-arena/index.html` in a browser. If a local branch already exists, omit `-b` and the remote branch argument and use the local branch name instead. The original planning machine already has these worktrees; do not create them a second time there.

All six are disposable, synthetic previews. Their AGY, FlowState, memory, and reviewer interactions are simulated.
