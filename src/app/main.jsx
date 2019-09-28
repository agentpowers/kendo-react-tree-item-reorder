import React from 'react';
import ReactDOM from 'react-dom';

import * as R from 'ramda';

import { TreeView, processTreeViewItems, TreeViewDragAnalyzer, TreeViewDragClue } from '@progress/kendo-react-treeview'
import '@progress/kendo-react-animation'
// import { interfaceDeclaration } from '@babel/types';

const SEPARATOR = '_';
const tree = [{
    id: 100,
    text: 'Furniture', 
    expanded: true,
    isFolder: true,
    items: [
      { id: 1, text: 'Tables & Chairs' },
      { id: 2, text: 'Sofas' },
      { id: 3, text: 'Occasional Furniture' }]
  }, {
    id: 101,
    text: 'Decor',
    expanded: true,
    isFolder: true,
    items: [
      { id: 4, text: 'Bed Linen' },
      { id: 5, text: 'Curtains & Blinds' },
      { 
        id: 102,
        text: 'Carpets',
        expanded: true,
        isFolder: true,
        items:[
          { id: 6, text: "High Pile" },
          { id: 7, text: "Low Pile" }
        ]
      }
    ]
}];

// const isSameFolder = (itemIndexes, targetIndexes) => {
//     // not need to continue if length is different
//     if (itemIndexes.length === targetIndexes.length) {
//         var itemParentFolder = itemIndexes[itemIndexes.length - 2];
//         var targetParentFolder = targetIndexes[targetIndexes.length - 2];
//         return itemParentFolder === targetParentFolder;
//     }
//     return false;
// }

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
                    var itemPathIndexes = event.itemHierarchicalIndex.split(SEPARATOR).map(g => parseInt(g));
                    var targetPathIndexes = eventAnalyzer.destinationMeta.itemHierarchicalIndex.split("_").map(g => parseInt(g));
                    return { canDrop: true, itemPathIndexes, targetPathIndexes };
                }
            }
        }
    }
    return { canDrop: false };
}

class App extends React.Component{
    dragClue;
    dragOverCnt = 0;
    isDragDrop = false;

    state = { tree, expand: { ids: [], idField: 'text' }, select: { ids: [], idField: 'text' }, updates: {} };

    render() {
        return (
            <div>
                <TreeView
                    draggable={true} onItemDragOver={this.onItemDragOver} onItemDragEnd={this.onItemDragEnd}
                    data={processTreeViewItems(
                        this.state.tree, { expand: this.state.expand, select: this.state.select }
                    )}
                    expandIcons={true} onExpandChange={this.onExpandChange} onItemClick={this.onItemClick}
                />
                <TreeViewDragClue ref={dragClue => this.dragClue = dragClue} />
            </div>
        );
    }

    onItemDragOver = (event) => {
        this.dragOverCnt++;
        this.dragClue.show(event.pageY + 10, event.pageX, event.item.text, this.getClueClassName(event));
    }
    onItemDragEnd = (event) => {
        this.isDragDrop = this.dragOverCnt > 0;
        this.dragOverCnt = 0;
        this.dragClue.hide();
        // const eventAnalyzer = new TreeViewDragAnalyzer(event).init();
        // // only allowed to move non folder items
        // if (event.item.isFolder) {
        //     return;
        // }
        // // check to see if drop is within same folder
        // // TODO: check to see if parseInt is necessary
        // var itemPathIndexes = event.itemHierarchicalIndex.split(SEPARATOR).map(g => parseInt(g));
        // var targetPathIndexes = eventAnalyzer.destinationMeta.itemHierarchicalIndex.split("_").map(g => parseInt(g));
        // const isWithinSameFolder = isSameFolder(itemPathIndexes, targetPathIndexes);
        // if (!isWithinSameFolder) {
        //     return;
        // }

        const { canDrop, itemPathIndexes, targetPathIndexes } = getEventMeta(event);

        if (!canDrop) {
            return;
        }
        // Rambda is used here to update the tree
        // take all but last index and add 'items' in between to get a full path to parent folder
        const parentFolderPath = itemPathIndexes.slice(0, itemPathIndexes.length - 1).reduce((acc, curr) => {
            acc.push(curr);
            acc.push("items");
            return acc;
        }, []);
        // create a lensPath to parent folder
        const parentFolderLensPath = R.lensPath(parentFolderPath);

        const updates = {};
        // update tree using R.over
        const updatedTree = 
            R.over(
                parentFolderLensPath,
                // items will be the enitre folder
                (items) => {
                    // make a copy of items
                    const itemsCopy = [...items];
                    // swap item and target
                    const itemIndex = itemPathIndexes[itemPathIndexes.length - 1];
                    const targetIndex = targetPathIndexes[targetPathIndexes.length - 1];
                    const itemRef = itemsCopy[itemIndex];
                    const targetRef = itemsCopy[targetIndex];

                    // add to updates list of changes ex: { id: index }
                    updates[itemRef.id] = targetIndex;
                    updates[targetRef.id] = itemIndex;

                    itemsCopy[itemIndex] = targetRef;
                    itemsCopy[targetIndex] = itemRef;
                    return itemsCopy;
                },
                this.state.tree
            );

        // update state
        this.setState({ tree: updatedTree, updates: {...this.state.updates, ...updates } });
    }
    onItemClick = (event) => {
        if (!this.isDragDrop) {
            let ids = this.state.select.ids.slice();
            const index = ids.indexOf(event.item.text);

            index === -1 ? ids.push(event.item.text) : ids.splice(index, 1);

            this.setState({ select: { ids, idField: 'text' } });
        }
    }
    onExpandChange = (event) => {
        let ids = this.state.expand.ids.slice();
        const index = ids.indexOf(event.item.text);

        index === -1 ? ids.push(event.item.text) : ids.splice(index, 1);

        this.setState({ expand: { ids, idField: 'text' } });
    }

    getClueClassName(event) {
        const { canDrop } = getEventMeta(event);

        return canDrop ? 'k-i-plus' : 'k-i-cancel';
    }
}

ReactDOM.render(
    <App />,
    document.querySelector('my-app')
);

