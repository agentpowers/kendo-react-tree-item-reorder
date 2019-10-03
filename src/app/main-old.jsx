import React from 'react';
import ReactDOM from 'react-dom';

import { TreeView, processTreeViewItems, moveTreeViewItem, TreeViewDragAnalyzer, TreeViewDragClue } from '@progress/kendo-react-treeview'
import '@progress/kendo-react-animation'

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

const SEPARATOR = '_';
const tree = [{
    text: 'Furniture', 
    expanded: true,
    isFolder: true,
    items: [
      { text: 'Tables & Chairs' },
      { text: 'Sofas' },
      { text: 'Occasional Furniture' }]
  }, {
    text: 'Decor',
    expanded: true,
    isFolder: true,
    items: [
      { text: 'Bed Linen' },
      { text: 'Curtains & Blinds' },
      { 
        text: 'Carpets',
        expanded: true,
        isFolder: true,
        items:[
          { text: "High Pile" },
          { text: "Low Pile" }
        ]
      }
    ]
}];

const getEventMeta = (event, tree) => {
    const eventAnalyzer = new TreeViewDragAnalyzer(event).init();
    const itemHierarchicalIndex = event.itemHierarchicalIndex;
    const { itemHierarchicalIndex: targetHierarchicalIndex } = eventAnalyzer.destinationMeta;
    // must not be same
    if (targetHierarchicalIndex && itemHierarchicalIndex !== targetHierarchicalIndex) {
        const targetItem = getTargetItem(eventAnalyzer.destinationMeta.itemHierarchicalIndex, tree);
        return { canDrop: event.item.isFolder === targetItem.isFolder, eventAnalyzer };
    }
    return { canDrop: false };
}

class App extends React.Component{
    dragClue;
    dragOverCnt = 0;
    isDragDrop = false;

    state = { tree, expand: { ids: [], idField: 'text' }, select: { ids: [], idField: 'text' } };

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
        this.dragClue.show(event.pageY + 10, event.pageX, event.item.text, this.getClueClassName(event, this.state.tree));
    }
    onItemDragEnd = (event) => {
        this.isDragDrop = this.dragOverCnt > 0;
        this.dragOverCnt = 0;
        this.dragClue.hide();

        const { canDrop, eventAnalyzer } = getEventMeta(event, this.state.tree);
        if (canDrop) {
            const op = eventAnalyzer.getDropOperation();
            if (op !== "child") {
                const updatedTree = moveTreeViewItem(
                    event.itemHierarchicalIndex,
                    this.state.tree,
                    op,
                    eventAnalyzer.destinationMeta.itemHierarchicalIndex,
                );

                this.setState({ tree: updatedTree });
            }
        }
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

    getClueClassName(event, tree) {
        const { canDrop, eventAnalyzer } = getEventMeta(event, tree);

        if (canDrop) {
            const { itemHierarchicalIndex: itemIndex } = eventAnalyzer.destinationMeta;
            switch (eventAnalyzer.getDropOperation()) {
                case 'before':
                    return itemIndex === '0' || itemIndex.endsWith(`${SEPARATOR}0`) ?
                        'k-i-insert-up' : 'k-i-insert-middle';
                case 'after':
                    const siblings = getSiblings(itemIndex, this.state.tree);
                    const lastIndex = Number(itemIndex.split(SEPARATOR).pop());

                    return lastIndex < siblings.length - 1 ? 'k-i-insert-middle' : 'k-i-insert-down';
                case 'child':
                default:
                    break;
            }
        }

        return 'k-i-cancel';
    }
}

ReactDOM.render(
    <App />,
    document.querySelector('my-app')
);

