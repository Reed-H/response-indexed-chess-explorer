#Ideas for chess app#
##to be documentation later :P##

1. Convert your eval bar to be centered on 0 properly
2. Add mate handling
3. Normalize evaluation for Black-to-move positions
4. Or start building the tree structure
5. Add evaluation caching by FEN
6. Or build a Node model for your opening tree
7. add transposition detection
8. add chess.js

- Need to render multiple board/position tree, made of static chessboard positions, not just the move label tree, that's fine to keep, but the primary feature of this app is the tree of chessboards.

- Make a way to easily import preloaded lines, starting positions, and trees.

- Add 'line highlighting' to the tree to highlight a specific move line, and dim the non selected nodes/traversal paths. 

- Add "clustering" nodes to group similar white responses; where either the only white variation is the same (two black moves, with the same single white response), or where one of the top 1, 2, or 3, (can be set by the user) white moves is the same in their respective child variations.

- Add existing "strategies" filtered by black and white move labels for easier and faster grouping. 

- Add meta-tagging for general line labeling, (not required for each node, but child nodes inherit), 

- Add a settings tab or window to change; background/theme, board color, background of the tree section. 

------------------------------------------------------------------------------------------------------
- Clustering is not rendering in any way on either the position tree or the JSON View. in the json example I gave you, these moves should cluster together: (1.1 a6 and 1.2 d6, since they share the same variation child - Bxc6, Bxc6+), (1.1 Nf6 and 1.2 Qe7, since they share the same variation child - Nc6) 
- Some of the text labels are becoming unredadable when going to dark mode. Text backgrounds are changing but not text colors creating a light gray text on nearly white background. 
- Board nodes are not showing hightlighting for imported lines and trees
- Create a full-color display mode for the tree when no lines are selected, and a Full-color line highlighting mode where the line connectors are boldened and highlighted in some way, and a mode to color code line connectors by line tags
- Make a way to import PGNs
- Change the layout again in this way... move the 'Move Variations' section to down below the 'Add Variation' section as a left panel, and move the Tree viewer to the right, spanning top to bottom. 
- Change the fullscreen mode from going fullscreen on the whole monitor to just spanning the whole app window. This should actually just be controlled by a 'collapse live board panel' button. Also, make the panels resizable by dragging in between them, with a mouse over indicator to show that it's resizable. Otherwise the resize control is hidden. Give the left panel a minimum size, roughly what it is now when not collapsed. 
- After you add a veriation, make it the default to change the live board to that variation position, like natural move progression on an analysis board. Make this a configurable option in the Add Variation section.
- Add click piece - click square as a move option, currently this doesn't seem to be working. After you click a piece it should show legal moves, then you click one of those squares it should go to that square. Right now only piece dragging is working. Add an option for 'show legal moves' on the live board, that shows legal moves for a selected piece, and doesn't when it's off. Make it on by default. 
- On the Tree view, add the option to change the node spacing, and add the option to change the tree from collapsed horizontally, to always spanning out like a pyramid. Allow for the node merging with clustering (see first note) and maintain proper alignment.
