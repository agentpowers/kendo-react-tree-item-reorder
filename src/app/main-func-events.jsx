import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom';

import * as R from 'ramda';

import { TreeView, TreeViewDragAnalyzer, TreeViewDragClue, moveTreeViewItem } from '@progress/kendo-react-treeview'
import '@progress/kendo-react-animation'

const is = (fileName, ext) => new RegExp(`.${ext}`).test(fileName);
function iconClassName({ text, items }) {
    if (items !== undefined) {
        return 'k-icon k-i-folder';
    } else if (is(text, 'pdf')) {
        return 'k-icon k-i-file-pdf';
    } else if (is(text, 'html')) {
        return 'k-icon k-i-html';
    } else if (is(text, 'jpg|png')) {
        return 'k-icon k-i-image';
    } else {
        return '';
    }
}
const SEPARATOR = '_';
const tree = [{
    id: 100,
    text: 'Furniture', 
    expanded: true,
    isFolder: true,
    items: [
      { id: 1, text: 'Tables & Chairs.jpg' },
      { id: 2, text: 'Sofas.pdf' },
      { id: 3, text: 'Occasional Furniture.gif' }]
  }, {
    id: 101,
    text: 'Decor',
    expanded: true,
    isFolder: true,
    items: [
      { id: 4, text: 'Bed Linen.pdf' },
      { id: 5, text: 'Curtains & Blinds.jpg' },
      { 
        id: 102,
        text: 'Carpets',
        expanded: true,
        isFolder: true,
        items:[
          { id: 6, text: "High Pile.html" },
          { id: 7, text: "Low Pile.png" }
        ]
      }
    ]
}];

const getHierarchicalIndexArray = (hierarchicalIndex) => hierarchicalIndex.split(SEPARATOR).map(g => Number(g));

const getHierarchicalTreeItemsPath = (hierarchicalIndexArray) => hierarchicalIndexArray.reduce((acc, curr) => {
    acc.push(curr);
    acc.push("items");
    return acc;
}, []);

const getHierarchicalTreeFoldersPath = (hierarchicalIndexArray) => hierarchicalIndexArray.reduce((acc, curr, index, orginalArray) => {
    acc.push(curr);
    // skip for all but last item
    if (index !== orginalArray.length - 1) {
        acc.push("items");
    }
    return acc;
}, []);

const getSiblings = (itemIndex, data) => {
    let result = data;

    const indices = itemIndex.split(SEPARATOR).map(index => Number(index));
    for (let i = 0; i < indices.length - 1; i++) {
        result = result[indices[i]].items;
    }

    return result;
};

const getTargetItem = (itemIndex, data) => {
    let result = data;

    const indices = itemIndex.split(SEPARATOR).map(index => Number(index));
    for (let i = 0; i < indices.length - 1; i++) {
        result = result[indices[i]].items;
    }

    return result[indices[indices.length - 1]];
};

const moveItemsInSameFolder = (tree, itemHierarchicalIndex, targetHierarchicalIndex) => {
    let changes = [];
    // Rambda is used here to update the tree
    const itemPathIndexes = getHierarchicalIndexArray(itemHierarchicalIndex);
    const targetPathIndexes = getHierarchicalIndexArray(targetHierarchicalIndex);
    // take all but last index and add 'items' in between to get a full path to parent folder
    const parentFolderPath = getHierarchicalTreeItemsPath(itemPathIndexes.slice(0, itemPathIndexes.length - 1));
    // create a lensPath to parent folder
    const parentFolderLensPath = R.lensPath(parentFolderPath);

    // update tree using R.over
    const updatedTree = R.over(
        parentFolderLensPath,
        // items will be the entire folder
        (items) => {
            const itemIndex = itemPathIndexes[itemPathIndexes.length - 1];
            const targetIndex = targetPathIndexes[targetPathIndexes.length - 1];
            // do move operation
            const updated = R.move(itemIndex, targetIndex, items);
            const isFolder = items[itemIndex].isFolder;
            // for debugging
            const originalDisplayOrder = items.reduce((acc, curr, index) => ({ ...acc, [curr.id] : index }), {});
            // record changes
            changes = isFolder
                ? updated.filter(d => d.isFolder).map((d, index) => ({ type: "folder-display-order-change", id: d.id, value: index, original: originalDisplayOrder[d.id] }))
                : updated.filter(d => !d.isFolder).map((d, index) => ({ type: "file-display-order-change", id: d.id, value: index, original: originalDisplayOrder[d.id] }));
            return updated;
        },
        tree
    );

    return { updatedTree, changes };
};

const getEventMeta = (event, tree) => {
    const eventAnalyzer = new TreeViewDragAnalyzer(event).init();
    const itemHierarchicalIndex = event.itemHierarchicalIndex;
    const { itemHierarchicalIndex: targetHierarchicalIndex } = eventAnalyzer.destinationMeta;
    // must not be same
    if (targetHierarchicalIndex && itemHierarchicalIndex !== targetHierarchicalIndex) {
        const targetItem = getTargetItem(eventAnalyzer.destinationMeta.itemHierarchicalIndex, tree);
        const canDrop = (event.item.isFolder === targetItem.isFolder) || (event.item.isFolder);
        return { canDrop, eventAnalyzer };
    }
    return { canDrop: false };
}

const folderMoveWithinFolder = "folder-move-within-folder";
const fileMoveWithinFolder = "file-move-within-folder";

const getEventMeta2 = (event, tree) => {
    const eventAnalyzer = new TreeViewDragAnalyzer(event).init();
    const itemHierarchicalIndex = event.itemHierarchicalIndex;
    const { itemHierarchicalIndex: targetHierarchicalIndex } = eventAnalyzer.destinationMeta;
    // must not be same
    if (targetHierarchicalIndex && itemHierarchicalIndex !== targetHierarchicalIndex) {
        let operationType = null;
        const targetItem = getTargetItem(eventAnalyzer.destinationMeta.itemHierarchicalIndex, tree);
        const canDrop = (event.item.isFolder === targetItem.isFolder) || (event.item.isFolder);
        // moving files or folders
        if (event.item.isFolder === targetItem.isFolder) {
            // is moving within same folder
            // has same length
            if (itemHierarchicalIndex.length === targetHierarchicalIndex.length){
                // check to see if item in root OR parent folder is same
                if (itemHierarchicalIndex.length === 1 || (itemHierarchicalIndex.slice(0, itemHierarchicalIndex.length - 2) === targetHierarchicalIndex.slice(0, targetHierarchicalIndex.length - 2))) {
                    operationType = targetItem.isFolder ? folderMoveWithinFolder : fileMoveWithinFolder;
                }
            }
        }
        return { canDrop, eventAnalyzer, targetItem, itemHierarchicalIndex, targetHierarchicalIndex, operationType };
    }
    return { canDrop: false };
}

const getClueClassName = (event, tree) => {
    const { canDrop, eventAnalyzer } = getEventMeta(event, tree);

    if (canDrop) {
        const { itemHierarchicalIndex: itemIndex } = eventAnalyzer.destinationMeta;
        switch (eventAnalyzer.getDropOperation()) {
            case 'before':
                return itemIndex === '0' || itemIndex.endsWith(`${SEPARATOR}0`) ?
                    'k-i-insert-up' : 'k-i-insert-middle';
            case 'child':
            case 'after':
                const siblings = getSiblings(itemIndex, tree);
                const lastIndex = Number(itemIndex.split(SEPARATOR).pop());

                return lastIndex < siblings.length - 1 ? 'k-i-insert-middle' : 'k-i-insert-down';
            default:
                break;
        }
    }

    return 'k-i-cancel';
}

const ItemRenderer = (props) => {
    return (
        <>
            <span className={iconClassName(props.item)} key='0'></span> {props.item.text}
        </>
    )
}

const App = ({ tree }) => {
    const dragClue = useRef(null);
    const [ dragOverCnt , setDragOverCnt ] = useState(0);
    const [ isDragDrop, setIsDragDrop ] = useState(false);
    const [ treeState, setTreeState ] = useState({ tree });

    const onItemDragOver = (event) => {
        setDragOverCnt(dragOverCnt + 1);
        dragClue.current.show(event.pageY + 10, event.pageX, event.item.text, getClueClassName(event, treeState.tree));
    }
    const onItemDragEnd = (event) => {
        setIsDragDrop(dragOverCnt > 0);
        setDragOverCnt(0);
        dragClue.current.hide();

        const { canDrop, eventAnalyzer, operationType, itemHierarchicalIndex, targetHierarchicalIndex } = getEventMeta2(event, treeState.tree);
        if (canDrop) {
            if (operationType === fileMoveWithinFolder || operationType === folderMoveWithinFolder) {
                const { updatedTree, changes } = moveItemsInSameFolder(treeState.tree, itemHierarchicalIndex, targetHierarchicalIndex);
                console.log(changes);
                // update state
                setTreeState({ tree: updatedTree }); 
            } else {
                const dropOp = eventAnalyzer.getDropOperation();
                const updatedTree = moveTreeViewItem(
                    event.itemHierarchicalIndex,
                    treeState.tree,
                    // we don't need child operations - forcing child to an "after"
                    dropOp === "child" ? "after" : dropOp,
                    eventAnalyzer.destinationMeta.itemHierarchicalIndex,
                );
                // update state
                setTreeState({ tree: updatedTree }); 
            }
        }
    }
    const onItemClick = (event) => {
        if (!isDragDrop) {
            console.log("clicked", event.item);
        }
    }
    const onExpandChange = (event) => {
        const itemPathIndexes = getHierarchicalIndexArray(event.itemHierarchicalIndex);
        let treePath = getHierarchicalTreeFoldersPath(itemPathIndexes);
        // add expanded to treePath
        treePath.push("expanded");
        const updatedTree = 
            R.set(
                R.lensPath(treePath),
                !event.item.expanded,
                treeState.tree
            );
        setTreeState({ tree: updatedTree });
    }

    return (
        <div>
            <TreeView
                draggable={true}
                onItemDragOver={onItemDragOver}
                onItemDragEnd={onItemDragEnd}
                data={treeState.tree}
                expandIcons={true}
                onExpandChange={onExpandChange}
                onItemClick={onItemClick}
                itemRender={ItemRenderer}
            />
            <TreeViewDragClue ref={dragClue} />
        </div>
    );
}

ReactDOM.render(
    <App tree={tree} />,
    document.querySelector('my-app')
);

