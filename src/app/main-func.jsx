import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom';

import * as R from 'ramda';

import { TreeView, TreeViewDragAnalyzer, TreeViewDragClue } from '@progress/kendo-react-treeview'
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

const getHierarchicalIndexArray = (hierarchicalIndex) => hierarchicalIndex.split(SEPARATOR).map(g => parseInt(g));

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


const getEventMeta = (event) => {
    if (!event.item.isFolder) {
        const eventAnalyzer = new TreeViewDragAnalyzer(event).init();
        const itemHierarchicalIndex = event.itemHierarchicalIndex;
        const { itemHierarchicalIndex: targetHierarchicalIndex } = eventAnalyzer.destinationMeta;
        // must have same length
        if (targetHierarchicalIndex && itemHierarchicalIndex.length === targetHierarchicalIndex.length) {
            // must have same parent folder
            const parentIndexLength = itemHierarchicalIndex.length - 2;
            if (itemHierarchicalIndex.slice(0, parentIndexLength) === targetHierarchicalIndex.slice(0, parentIndexLength)) {
                // must not be same index
                if (itemHierarchicalIndex[itemHierarchicalIndex.length - 1] !== targetHierarchicalIndex[itemHierarchicalIndex.length - 1]) {
                    var itemPathIndexes = getHierarchicalIndexArray(event.itemHierarchicalIndex);
                    var targetPathIndexes = getHierarchicalIndexArray(eventAnalyzer.destinationMeta.itemHierarchicalIndex);
                    return { canDrop: true, itemPathIndexes, targetPathIndexes };
                }
            }
        }
    }
    return { canDrop: false };
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
        dragClue.current.show(event.pageY + 10, event.pageX, event.item.text, getClueClassName(event));
    }
    const onItemDragEnd = (event) => {
        setIsDragDrop(dragOverCnt > 0);
        setDragOverCnt(0);
        dragClue.current.hide();

        // get event meta
        const { canDrop, itemPathIndexes, targetPathIndexes } = getEventMeta(event);

        if (!canDrop) {
            return;
        }
        // Rambda is used here to update the tree
        // take all but last index and add 'items' in between to get a full path to parent folder
        const parentFolderPath = getHierarchicalTreeItemsPath(itemPathIndexes.slice(0, itemPathIndexes.length - 1));
        // create a lensPath to parent folder
        const parentFolderLensPath = R.lensPath(parentFolderPath);

        // update tree using R.over
        const updatedTree = 
            R.over(
                parentFolderLensPath,
                // items will be the enitre folder
                (items) => {
                    const itemIndex = itemPathIndexes[itemPathIndexes.length - 1];
                    const targetIndex = targetPathIndexes[targetPathIndexes.length - 1];
                    // do move operation
                    return R.move(itemIndex, targetIndex, items);
                },
                treeState.tree
            );

        // update state
        setTreeState({ tree: updatedTree });
    }
    const onItemClick = (event) => {
        if (!isDragDrop) {
            console.log("clicked", event.item);
        }
    }
    const onExpandChange = (event) => {
        debugger;
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
    const getClueClassName = (event) => {
        // get event meta
        const { canDrop } = getEventMeta(event);

        return canDrop ? 'k-i-plus' : 'k-i-cancel';
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

