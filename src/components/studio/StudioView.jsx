import React, { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import useLuminaStore from '../../stores/store';
import { nodeTypes } from './nodes/WorkflowNode';
import Sidebar from './Sidebar';

// Convert blocks array → React Flow nodes with auto-layout
function blocksToNodes(blocks) {
  const typeGroups = { trigger: [], source: [], output: [] };
  blocks.forEach((b) => {
    if (typeGroups[b.type]) typeGroups[b.type].push(b);
  });

  const nodes = [];
  const colX = { trigger: 60, source: 340, output: 940 };

  Object.entries(typeGroups).forEach(([type, group]) => {
    group.forEach((block, i) => {
      nodes.push({
        id: block.id,
        type: block.type,
        position: block.position || {
          x: colX[type] || 340,
          y: 60 + i * 120,
        },
        data: { ...block },
      });
    });
  });

  return nodes;
}

const PROMPT_NODE_ID = 'prompt-node';

// Auto-generate edges: triggers → sources → prompt → outputs
function blocksToEdges(blocks) {
  const triggers = blocks.filter((b) => b.type === 'trigger');
  const sources = blocks.filter((b) => b.type === 'source');
  const outputs = blocks.filter((b) => b.type === 'output');
  const edges = [];

  // Each trigger connects to each source
  triggers.forEach((t) => {
    sources.forEach((s) => {
      edges.push({
        id: `e-${t.id}-${s.id}`,
        source: t.id,
        target: s.id,
        animated: true,
        style: { stroke: '#7C3AED', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#7C3AED', width: 16, height: 16 },
      });
    });
  });

  // Each source connects to prompt node
  sources.forEach((s) => {
    edges.push({
      id: `e-${s.id}-${PROMPT_NODE_ID}`,
      source: s.id,
      target: PROMPT_NODE_ID,
      animated: true,
      style: { stroke: '#F59E0B', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#F59E0B', width: 16, height: 16 },
    });
  });

  // Prompt node connects to each output
  outputs.forEach((o) => {
    edges.push({
      id: `e-${PROMPT_NODE_ID}-${o.id}`,
      source: PROMPT_NODE_ID,
      target: o.id,
      animated: true,
      style: { stroke: '#10B981', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#10B981', width: 16, height: 16 },
    });
  });

  return edges;
}

// Convert React Flow nodes back to blocks for storage
function nodesToBlocks(nodes) {
  return nodes.map((n) => ({
    id: n.id,
    type: n.data.type,
    source: n.data.source,
    destination: n.data.destination,
    config: n.data.config,
    position: n.position,
  }));
}

export default function StudioView() {
  const {
    editingWorkflow,
    updateEditingWorkflow,
    saveWorkflow,
    compileSkill,
    closeStudio,
    loading,
    compiling,
  } = useLuminaStore();

  const [selectedNode, setSelectedNode] = useState(null);
  const [showSkill, setShowSkill] = useState(false);

  const instructionsHandlerRef = useRef(null);

  const initialBlocks = editingWorkflow?.blocks || [];
  const promptPosition = editingWorkflow?.promptPosition || { x: 590, y: 80 };
  const [nodes, setNodes, onNodesChange] = useNodesState([
    ...blocksToNodes(initialBlocks),
    {
      id: PROMPT_NODE_ID,
      type: 'prompt',
      position: promptPosition,
      data: {
        instructions: editingWorkflow?.instructions || '',
        onInstructionsChange: (val) => instructionsHandlerRef.current?.(val),
      },
    },
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(blocksToEdges(initialBlocks));

  // Wire up the instructions change handler now that setNodes is available
  instructionsHandlerRef.current = (val) => {
    updateEditingWorkflow({ instructions: val });
    setNodes((nds) =>
      nds.map((n) =>
        n.id === PROMPT_NODE_ID
          ? { ...n, data: { ...n.data, instructions: val } }
          : n
      )
    );
  };

  // Sync nodes back to workflow blocks whenever nodes change
  const syncToStore = useCallback((currentNodes) => {
    const blockNodes = currentNodes.filter((n) => n.id !== PROMPT_NODE_ID);
    const promptNode = currentNodes.find((n) => n.id === PROMPT_NODE_ID);
    updateEditingWorkflow({
      blocks: nodesToBlocks(blockNodes),
      ...(promptNode ? { promptPosition: promptNode.position } : {}),
    });
  }, [updateEditingWorkflow]);

  const onNodesChangeWrapped = useCallback((changes) => {
    onNodesChange(changes);
    // Debounced sync on position changes
    const hasPositionChange = changes.some((c) => c.type === 'position' && c.dragging === false);
    if (hasPositionChange) {
      setNodes((nds) => {
        syncToStore(nds);
        return nds;
      });
    }
  }, [onNodesChange, setNodes, syncToStore]);

  const onConnect = useCallback((params) => {
    setEdges((eds) =>
      addEdge(
        {
          ...params,
          animated: true,
          style: { stroke: '#7C3AED', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#7C3AED', width: 16, height: 16 },
        },
        eds
      )
    );
  }, [setEdges]);

  const onNodeClick = useCallback((_event, node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const addNode = useCallback((template) => {
    const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const existingOfType = nodes.filter((n) => n.data.type === template.type);
    const colX = { trigger: 60, source: 340, output: 940 };

    const newNode = {
      id,
      type: template.type,
      position: {
        x: colX[template.type] || 340,
        y: 60 + existingOfType.length * 120,
      },
      data: { id, ...template },
    };

    setNodes((nds) => {
      const updated = [...nds, newNode];
      syncToStore(updated);
      const blocks = nodesToBlocks(updated.filter((n) => n.id !== PROMPT_NODE_ID));
      setEdges(blocksToEdges(blocks));
      return updated;
    });
  }, [nodes, setNodes, setEdges, syncToStore]);

  const removeNode = useCallback((nodeId) => {
    if (nodeId === PROMPT_NODE_ID) return; // Can't delete prompt node
    setNodes((nds) => {
      const updated = nds.filter((n) => n.id !== nodeId);
      syncToStore(updated);
      const blocks = nodesToBlocks(updated.filter((n) => n.id !== PROMPT_NODE_ID));
      setEdges(blocksToEdges(blocks));
      return updated;
    });
    if (selectedNode?.id === nodeId) setSelectedNode(null);
  }, [setNodes, setEdges, syncToStore, selectedNode]);

  const updateNodeData = useCallback((nodeId, updates) => {
    setNodes((nds) => {
      const updated = nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...updates, config: { ...n.data.config, ...updates.config } } } : n
      );
      syncToStore(updated);
      // Update selected node reference
      const updatedNode = updated.find((n) => n.id === nodeId);
      if (updatedNode) setSelectedNode(updatedNode);
      return updated;
    });
  }, [setNodes, syncToStore]);

  const handleSave = async () => {
    // Final sync before save
    syncToStore(nodes);
    await saveWorkflow();
  };

  const handleCompile = async () => {
    syncToStore(nodes);
    if (!editingWorkflow.id) await saveWorkflow();
    const result = await compileSkill();
    if (result) setShowSkill(true);
  };

  if (!editingWorkflow) return null;

  return (
    <div className="h-full flex flex-col bg-lumina-bg">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-3 border-b border-lumina-border bg-lumina-surface">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={closeStudio}
              className="text-lumina-text-secondary hover:text-lumina-text p-1.5 rounded-lg hover:bg-lumina-border-light transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
              </svg>
            </button>
            <div>
              <input type="text" value={editingWorkflow.name}
                onChange={(e) => updateEditingWorkflow({ name: e.target.value })}
                className="text-base font-semibold bg-transparent border-none outline-none w-64"
                placeholder="Workflow name..." />
              <input type="text" value={editingWorkflow.description}
                onChange={(e) => updateEditingWorkflow({ description: e.target.value })}
                className="text-xs text-lumina-text-secondary bg-transparent border-none outline-none w-64 block mt-0.5"
                placeholder="Add a description..." />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={loading}
              className="px-4 py-1.5 border border-lumina-border rounded-lg text-sm font-medium hover:bg-lumina-border-light transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button onClick={handleCompile} disabled={compiling || nodes.filter((n) => n.id !== PROMPT_NODE_ID).length === 0}
              className={`px-4 py-1.5 bg-lumina-accent text-white rounded-lg text-sm font-semibold hover:bg-lumina-accent/90 transition-all disabled:opacity-50 ${compiling ? 'compile-glow animate-pulse' : ''}`}>
              {compiling ? (
                <span className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                  Compiling...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  Compile
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* React Flow canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChangeWrapped}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.6, maxZoom: 1 }}
            defaultEdgeOptions={{
              animated: true,
              style: { strokeWidth: 2 },
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#E5E5E5" gap={20} size={1} />
            <Controls
              showInteractive={false}
              className="!shadow-card !border-lumina-border !rounded-lg"
            />
          </ReactFlow>
        </div>

        {/* Right sidebar */}
        <Sidebar
          selectedNode={selectedNode}
          onAddNode={addNode}
          onRemoveNode={removeNode}
          onUpdateNode={updateNodeData}
          showSkill={showSkill}
          skillContent={editingWorkflow.skillContent}
          onCloseSkill={() => setShowSkill(false)}
        />
      </div>
    </div>
  );
}
