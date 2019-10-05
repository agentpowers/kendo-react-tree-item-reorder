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
    _id: 'f100',
    text: 'Furniture', 
    expanded: true,
    isFolder: true,
    items: [
      { id: 1, _id:'1', text: 'Tables & Chairs.jpg' },
      { id: 2, _id:'2', text: 'Sofas.pdf' },
      { id: 3, _id:'3', text: 'Occasional Furniture.gif' }]
  }, {
    id: 101,
    _id:'f101',
    text: 'Decor',
    expanded: true,
    isFolder: true,
    items: [
      { id: 4, _id:'4', text: 'Bed Linen.pdf' },
      { id: 5, _id:'5', text: 'Curtains & Blinds.jpg' },
      { 
        id: 102,
        _id:'f102',
        text: 'Carpets',
        expanded: true,
        isFolder: true,
        items:[
          { id: 6, _id:'6', text: "High Pile.html" },
          { id: 7, _id:'7', text: "Low Pile.png" }
        ]
      }
    ]
}];

const getHierarchicalIndexArray = (hierarchicalIndex) => hierarchicalIndex.split(SEPARATOR).map(g => parseInt(g));

// const getHierarchicalTreeItemsPath = (hierarchicalIndexArray) => hierarchicalIndexArray.reduce((acc, curr) => {
//     acc.push(curr);
//     acc.push("items");
//     return acc;
// }, []);

const getHierarchicalTreeFoldersPath = (hierarchicalIndexArray) => hierarchicalIndexArray.reduce((acc, curr, index, orginalArray) => {
    acc.push(curr);
    // skip for all but last item
    if (index !== orginalArray.length - 1) {
        acc.push("items");
    }
    return acc;
}, []);

function getSiblings(itemIndex, data) {
    let result = data;

    const indices = itemIndex.split(SEPARATOR).map(index => Number(index));
    for (let i = 0; i < indices.length - 1; i++) {
        result = result[indices[i]].items;
    }

    return result;
}

function getTargetItem(itemIndex, data) {
    let result = data;

    const indices = itemIndex.split(SEPARATOR).map(index => Number(index));
    for (let i = 0; i < indices.length - 1; i++) {
        result = result[indices[i]].items;
    }

    return result[indices[indices.length - 1]];
}

const getEventMeta = (event, tree) => {
    const eventAnalyzer = new TreeViewDragAnalyzer(event).init();
    const itemHierarchicalIndex = event.itemHierarchicalIndex;
    const { itemHierarchicalIndex: targetHierarchicalIndex } = eventAnalyzer.destinationMeta;
    // must not be same
    if (targetHierarchicalIndex && itemHierarchicalIndex !== targetHierarchicalIndex) {
        const targetItem = getTargetItem(eventAnalyzer.destinationMeta.itemHierarchicalIndex, tree);
        const canDrop = true; //(event.item.isFolder === targetItem.isFolder) || (event.item.isFolder);
        return { canDrop, eventAnalyzer, targetItem, targetHierarchicalIndex, itemHierarchicalIndex };
    }
    return { canDrop: false };
}

const getClueClassName = (event, tree) => {
    const { canDrop, eventAnalyzer } = getEventMeta(event, tree);

    if (canDrop) {
        const { itemHierarchicalIndex: itemIndex } = eventAnalyzer.destinationMeta;
        switch (eventAnalyzer.getDropOperation()) {
            case 'child':
                return 'k-i-plus';
            case 'before':
                return itemIndex === '0' || itemIndex.endsWith(`${SEPARATOR}0`) ?
                    'k-i-insert-up' : 'k-i-insert-middle';
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
            <span className={iconClassName(props.item)} key='0'></span> {props.item.id}-{props.item.text}
        </>
    )
}

const flatten = (items, parentId) => {
    if(Array.isArray(items)) {
        let result = {};
        for (let index = 0; index < items.length; index++) {
            const item = items[index];
            result[item._id] = { item, index, parentId };
            if (item.isFolder) {
                result = {
                    ...result,
                    ...(flatten(item.items, item.id))
                }
            }
        }
        return result;
    }
    return {};
};

const rootFlatten = (item, index) => {
    let result = {};
    result[item._id] = { item, index, parentId: null };
    if (item.isFolder) {
        result = {
            ...result,
            ...(flatten(item.items, item.id))
        };
    }

    return result;
};

const getDiff2 = (original, updated) => {
    let changed = [];
    let added = [];
    let deleted = [];
    let originalFlatten = {};
    let updatedFlatten = {};
    for (let index = 0; index < Math.max(original.length, updated.length); index++) {
        if (original.length > index && updated.length > index) {
            if (original[index] === updated[index]){
                continue;
            } else {
                originalFlatten = {
                    ...originalFlatten,
                    ...(rootFlatten(original[index], index))
                };
                updatedFlatten = {
                    ...updatedFlatten,
                    ...(rootFlatten(updated[index], index))
                };
            }
            continue;
        }
        if (original.length > index) {
            originalFlatten = {
                ...originalFlatten,
                ...(rootFlatten(original[index], index))
            };
        }
        if (updated.length > index) {
            updatedFlatten = {
                ...updatedFlatten,
                ...(rootFlatten(updated[index], index))
            };
        }
    }
    Object.keys(updatedFlatten).forEach(key => {
        const g = updatedFlatten[key];
        var original = originalFlatten[key];
        if(original) {
            if (g.index !== original.index) {
                changed.push({
                    type: g.item.isFolder ? "folder-display-order-change" : "file-display-order-change",
                    id: g.item.id,
                    value: g.index
                });
            }
            if (g.parentId !== original.parentId) {
                changed.push({
                    type: g.item.isFolder ? "folder-parent-change" : "file-parent-change",
                    id: g.item.id,
                    value: g.parentId
                });
            }
        } else {
            added.push({
                type: g.item.isFolder ? "folder-added" : "file-added",
                id: g.item.id,
                value: g.parentId
            });
        }
    });

    // check for deleted
    deleted = Object.keys(updatedFlatten).filter(f => !updatedFlatten[f]).map(f => updatedFlatten[f]).map(upd => {
        return {
            type: upd.isFolder ? "folder-deleted" : "file-deleted",
            id: upd.item.id,
            value: null
        };
    });

    return { changed, added, deleted };
}

const getDiff = (original, updated, parentId) => {
    let changes = {};
    let added = {};
    let deleted = {};
    if (updated == null && Array.isArray(original)) {
        for (let index = 0; index < original.length; index++) {
            const orginalItem = original[index];
            deleted[orginalItem.id] = {
                type: orginalItem.isFolder ? "folder-deleted" : "file-deleted",
                id: orginalItem.id,
                value: null
            };

            if (orginalItem.isFolder) {
                const { changes : c, added : a, deleted : d } = getDiff(orginalItem.items, null, orginalItem.id);
                changes = {
                    ...changes,
                    ...c
                };
                added = {
                    ...added,
                    ...a
                };
                deleted = {
                    ...deleted,
                    ...d
                };
            }
        }
    }
    if (Array.isArray(updated)) {
        const originalIdMap = original ? original.reduce((acc, curr) => {
            acc[curr._id] = true;
            return acc;
        }, {}) : {};
        for (let index = 0; index < updated.length; index++) {
            const updItm = updated[index];
            const hasOriginalId = originalIdMap[updItm._id];
            const hasOriginalAtSameIndex = original && (original.length > index) && (original[index].id === updated[index].id);

            if (!hasOriginalAtSameIndex) {
                // add display order change
                changes[updItm._id] = {
                    type: updItm.isFolder ? "folder-display-order-change" : "file-display-order-change",
                    id: updItm.id,
                    value: index
                };
            }

            // if new item then add it
            if (hasOriginalId){
                delete originalIdMap[updItm._id]
            } else {
                added[updItm.id] = {
                    type: updItm.isFolder ? "folder-added" : "file-added",
                    id: updItm.id,
                    value: parentId
                };
            }
            if (updItm.isFolder) {
                const { changes : c, added : a, deleted : d } = getDiff(hasOriginalAtSameIndex ? original[index].items : null, updItm.items, updItm.id);
                changes = {
                    ...changes,
                    ...c
                };
                added = {
                    ...added,
                    ...a
                };
                deleted = {
                    ...deleted,
                    ...d
                };
            }
        }
        // if there are leftover in originalIdMap then they are deleted
        deleted = Object.values(originalIdMap).map(item => ({
            type: item.isFolder ? "folder-deleted" : "file-deleted",
            id: item.id,
            value: null
        }));
    }
    return { changes, added, deleted };
};

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

        const { canDrop, eventAnalyzer, targetItem, itemHierarchicalIndex, targetHierarchicalIndex } = getEventMeta(event, treeState.tree);
        if (canDrop) {
            const originalDropOp = eventAnalyzer.getDropOperation();
            // we don't need child operations on files- forcing child to an "after"
            const dropOp = (originalDropOp === "child"  && targetItem.isFolder) ? originalDropOp : "after";
            const updatedTree = moveTreeViewItem(
                itemHierarchicalIndex,
                treeState.tree,
                dropOp,
                targetHierarchicalIndex,
            );
            const diff = getDiff2(treeState.tree, updatedTree);
            console.log(diff);
            // update state
            setTreeState({ tree: updatedTree });
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

