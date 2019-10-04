import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom';

import * as R from 'ramda';

import { TreeView, TreeViewDragAnalyzer, TreeViewDragClue } from '@progress/kendo-react-treeview'
import '@progress/kendo-react-animation'

const is = R.memoizeWith(R.identity, (fileName, ext) => new RegExp(`.${ext}`).test(fileName));
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

const getIntegerIndex = R.memoizeWith(R.identity, (i) => Number(i));

const getHierarchicalIndexArray = R.memoizeWith(R.identity, (hierarchicalIndex) => hierarchicalIndex.split(SEPARATOR).map(getIntegerIndex));

const getSiblingFolderPath = R.memoizeWith(R.identity, (hierarchicalIndexArray) => hierarchicalIndexArray.reduce((acc, curr) => {
    acc.push(curr);
    acc.push("items");
    return acc;
}, []));

const getParentFolderPath = R.memoizeWith(R.identity, (hierarchicalIndexArray) => hierarchicalIndexArray.reduce((acc, curr, index, orginalArray) => {
    acc.push(curr);
    // skip for all but last item
    if (index !== orginalArray.length - 1) {
        acc.push("items");
    }
    return acc;
}, []));

const getSiblings = (itemIndex, data) => {
    let result = data;

    const indices = getHierarchicalIndexArray(itemIndex);
    for (let i = 0; i < indices.length - 1; i++) {
        result = result[indices[i]].items;
    }

    return result;
};

const getTargetItem = (itemIndex, data) => {
    let result = data;

    const indices = getHierarchicalIndexArray(itemIndex);
    for (let i = 0; i < indices.length - 1; i++) {
        result = result[indices[i]].items;
    }

    return result[indices[indices.length - 1]];
};

const removeItem = (tree, index) => {
    let changes = [];
    const itemPathIndexes = getHierarchicalIndexArray(index);
    // take all but last index and add 'items' in between to get a full path to parent folder
    const siblingFolderPath = getSiblingFolderPath(itemPathIndexes.slice(0, itemPathIndexes.length - 1));
    // create a lensPath to parent folder
    const siblingFolderLensPath = R.lensPath(siblingFolderPath);

    // update tree using R.over
    const updatedTree = R.over(
        siblingFolderLensPath,
        // items
        (items) => {
            const itemIndex = itemPathIndexes[itemPathIndexes.length - 1];
            const isFolder = items[itemIndex].isFolder;
            // for debugging
            const originalDisplayOrder = items.reduce((acc, curr, index) => ({ ...acc, [curr.id] : index }), {});

            // remove item
            const updated = R.remove(itemIndex, 1, items);
            // record changes
            changes = updated
                .filter(d => d.isFolder === isFolder)
                .map((d, index) => ({ 
                    type: isFolder ? "folder-display-order-change" : "file-display-order-change",
                    id: d.id,
                    value: index,
                    original: originalDisplayOrder[d.id]
                }));
            return updated;
        },
        tree
    );

    return { updatedTree, changes };
};
const getIndexAdjustedForRemoval = (index, removedAtIndex) => {
    // create a new array here to so we don't mutate index(which is returned from a memoized function)
    const indexArray = [ ...getHierarchicalIndexArray(index)];
    const removedAtIndexArray = getHierarchicalIndexArray(removedAtIndex);
    for (let i = 0; i < Math.min(indexArray.length, removedAtIndexArray.length); i++) {
        if(removedAtIndexArray[i] > indexArray[i]) {
            break;
        }
        if (indexArray[i] === removedAtIndexArray[i]) {
            continue;
        }
        indexArray[i] -= (removedAtIndexArray[i] || 1);
    }

    return indexArray;
};
const addItem = (tree, item, targetItem, index, removedAtIndex) => {
    let changes = [];
    debugger;
    const adjustedIndex = item.isFolder ? getIndexAdjustedForRemoval(index,removedAtIndex).join('_') : index;
    console.log('removedAtIndex', removedAtIndex);
    console.log('targetIndex', index);
    console.log('adjustedTargetIndex', adjustedIndex);
    const itemPathIndexes = getHierarchicalIndexArray(adjustedIndex);
    // take all but last index and add 'items' in between to get a full path to parent folder
    const parentFolderPath = getParentFolderPath(itemPathIndexes.slice(0, itemPathIndexes.length - 1));
    // create a lensPath to parent folder
    const parentFolderLensPath = R.lensPath(parentFolderPath);

    // update tree using R.over
    const updatedTree = R.over(
        parentFolderLensPath,
        (folder) => {
            debugger;
            const isRoot = itemPathIndexes.length === 1;
            // if root then folder itself is items else folder.items
            const items = isRoot ? folder : folder.items; 
            const itemIndex = itemPathIndexes[itemPathIndexes.length - 1];
            const isFolder = item.isFolder;
            // for debugging
            const originalDisplayOrder = items.reduce((acc, curr, index) => ({ ...acc, [curr.id] : index }), {});
            // add item
            let updated = [];
            if (item.isFolder === targetItem.isFolder) { // dropping folder into folder OR file into file
                updated = R.insert(itemIndex, item, items);
            } else if (item.isFolder && !targetItem.isFolder) { // dropping folder into file
                updated = [...items, item];
            } else if (!item.isFolder && targetItem.isFolder) { // dropping file into folder
                updated = [item, ...items];
            }
            const insertChange = { type: "folder-change", id: item.id, value: folder.id };
            // record changes
            changes = [ 
                insertChange, 
                ...(updated.filter(d => d.isFolder === isFolder)
                            .map((d, index) => ({ 
                                type: isFolder ? "folder-display-order-change" : "file-display-order-change",
                                id: d.id,
                                value: index,
                                original: originalDisplayOrder[d.id]
                            })))
            ];
            // if root then return updated itself else return a shallow copied folder
            return isRoot
                ? updated
                : {
                    ...folder,
                    items: updated
                };
        },
        tree
    );

    return { updatedTree, changes };
}; 

const moveItemsInSameFolder = (tree, itemHierarchicalIndex, targetHierarchicalIndex) => {
    let changes = [];
    // Rambda is used here to update the tree
    const itemPathIndexes = getHierarchicalIndexArray(itemHierarchicalIndex);
    const targetPathIndexes = getHierarchicalIndexArray(targetHierarchicalIndex);
    // take all but last index and add 'items' in between to get a full path to parent folder
    const parentFolderPath = getSiblingFolderPath(itemPathIndexes.slice(0, itemPathIndexes.length - 1));
    // create a lensPath to parent folder
    const parentFolderLensPath = R.lensPath(parentFolderPath);

    // update tree using R.over
    const updatedTree = R.over(
        parentFolderLensPath,
        // items will be the entire folder
        (items) => {
            const itemIndex = itemPathIndexes[itemPathIndexes.length - 1];
            const targetIndex = targetPathIndexes[targetPathIndexes.length - 1];
            const isFolder = items[itemIndex].isFolder;
            // for debugging
            const originalDisplayOrder = items.reduce((acc, curr, index) => ({ ...acc, [curr.id] : index }), {});

            // do move operation
            const updated = R.move(itemIndex, targetIndex, items);

            // record changes
            changes = updated
                .filter(d => d.isFolder === isFolder)
                .map((d, index) => ({ 
                    type: isFolder ? "folder-display-order-change" : "file-display-order-change",
                    id: d.id,
                    value: index,
                    original: originalDisplayOrder[d.id]
                }));
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
    if (targetHierarchicalIndex && itemHierarchicalIndex !== targetHierarchicalIndex && !targetHierarchicalIndex.startsWith(itemHierarchicalIndex)) {
        const targetItem = getTargetItem(eventAnalyzer.destinationMeta.itemHierarchicalIndex, tree);
        const canDrop = (event.item.isFolder === targetItem.isFolder) || (event.item.isFolder);
        return { canDrop, eventAnalyzer, targetItem, itemHierarchicalIndex, targetHierarchicalIndex };
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

        const { canDrop, targetItem, itemHierarchicalIndex, targetHierarchicalIndex } = getEventMeta(event, treeState.tree);
        if (canDrop) {
            if (event.item.isFolder === targetItem.isFolder) {
                // is moving within same folder
                // has same length
                if (itemHierarchicalIndex.length === targetHierarchicalIndex.length){
                    // check to see if item in root OR parent folder is same
                    if (itemHierarchicalIndex.length === 1 || (itemHierarchicalIndex.slice(0, itemHierarchicalIndex.length - 2) === targetHierarchicalIndex.slice(0, targetHierarchicalIndex.length - 2))) {
                        const { updatedTree, changes } = moveItemsInSameFolder(treeState.tree, itemHierarchicalIndex, targetHierarchicalIndex);
                        console.log(changes);
                        // update state
                        setTreeState({ tree: updatedTree }); 
                        return;
                    }
                }
            }
            // get original target item from current tree
            const originalTarget = getTargetItem(targetHierarchicalIndex, treeState.tree);
            // remove item 
            const { updatedTree, changes : removedChanges } = removeItem(treeState.tree, itemHierarchicalIndex);
            // add item
            const { updatedTree: finalTree, changes: addChanges } = addItem(updatedTree, event.item, originalTarget, targetHierarchicalIndex, itemHierarchicalIndex);
            // set state
            setTreeState({ tree: finalTree });
        }
    }
    const onItemClick = (event) => {
        if (!isDragDrop) {
            console.log("clicked", event.item);
        }
    }
    const onExpandChange = (event) => {
        const itemPathIndexes = getHierarchicalIndexArray(event.itemHierarchicalIndex);
        let treePath = getParentFolderPath(itemPathIndexes);
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

