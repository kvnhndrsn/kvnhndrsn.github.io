---
layout: default
title: Config
---

```
# Hyprland Config - Picture-in-Picture
windowrule = match:title ^([Pp]icture[-\s]?[Ii]n[-\s]?[Pp]icture)(.*)$, float on
windowrule = match:title ^([Pp]icture[-\s]?[Ii]n[-\s]?[Pp]icture)(.*)$, keep_aspect_ratio on
windowrule = match:title ^([Pp]icture[-\s]?[Ii]n[-\s]?[Pp]icture)(.*)$, move (monitor_w*.0) (monitor_h*.75)
windowrule = match:title ^([Pp]icture[-\s]?[Ii]n[-\s]?[Pp]icture)(.*)$, size (monitor_w*.25) (monitor_h*.25)
windowrule = match:title ^([Pp]icture[-\s]?[Ii]n[-\s]?[Pp]icture)(.*)$, float on
windowrule = match:title ^([Pp]icture[-\s]?[Ii]n[-\s]?[Pp]icture)(.*)$, pin on
```


