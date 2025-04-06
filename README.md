# AREDL Thumbnails   
This repository serves as a utility repo to store thumbnails used on the AREDL V3 site frontend.   
This uses base thumbnails from the [Levels thumbnails geode mod repo](https://github.com/cdc-sys/level-thumbnails).    
This repo stores :
- For each level that's on AREDL :
	- A full version of the thumbnail in /levels/full
	- A "card" version of the thumbnail, which is the thumbnail cropped horizontally around the center of it, to be used in the different profile pages on the AREDL V3 frontend, in /levels/cards
- For each pack that's on AREDL, a thumbnail made of this pack's tier color, and of each level's thumbnail that is part of this pack, in /packs

A github action runs regularly to update levels and packs thumbnails based on current AREDL data.