WORKFLOWS_DATA = \
[
    {
        "id": "b86219b8-b5d7-439b-8ff8-a2fc17e6ae9d",
        "name": "Checker",
        "owner_id": "7e7a1eef-e7b8-40ae-9f06-74bc268496a4",
        "category": "personal",
        "status": "draft",
        "graph": {
            "nodes": [
                {
                    "id": "node_start",
                    "type": "start",
                    "position": {
                        "x": 100,
                        "y": 100
                    },
                    "deletable": false,
                    "data": {
                        "label": "Start",
                        "nodeType": "Start"
                    },
                    "width": 250,
                    "height": 130
                },
                {
                    "id": "node_1772620281315",
                    "type": "action",
                    "position": {
                        "x": 100,
                        "y": 300
                    },
                    "data": {
                        "nodeTypeId": "7194c010-4a63-4c35-9de4-b970f56271d3",
                        "label": "sql query",
                        "category": "Database",
                        "params": {
                            "query": "select users.username, users.role from users"
                        },
                        "icon": "text"
                    },
                    "width": 250,
                    "height": 115
                },
                {
                    "id": "node_1772620288887",
                    "type": "action",
                    "position": {
                        "x": 100,
                        "y": 460
                    },
                    "data": {
                        "nodeTypeId": "c290e2eb-8cb7-4c4c-a2d1-9f0f69b9e8e9",
                        "label": "Runtime Data Write",
                        "category": "Data|Runtime",
                        "params": {
                            "name_from": "output",
                            "name_as": "users",
                            "merge": true
                        },
                        "icon": "text"
                    },
                    "width": 250,
                    "height": 157,
                    "selected": true,
                    "positionAbsolute": {
                        "x": 100,
                        "y": 460
                    },
                    "dragging": false
                }
            ],
            "edges": [
                {
                    "id": "e_node_start-node_1772620281315",
                    "source": "node_start",
                    "sourceHandle": null,
                    "target": "node_1772620281315",
                    "targetHandle": "top"
                },
                {
                    "id": "e_node_1772620281315-node_1772620288887",
                    "source": "node_1772620281315",
                    "sourceHandle": "output",
                    "target": "node_1772620288887",
                    "targetHandle": "top"
                }
            ]
        },
        "workflow_data": {}
    },
    {
        "id": "661cd80c-8b8d-4f02-8439-b96e5f9a7da4",
        "name": "Client1 workflow test",
        "owner_id": "2f333350-87b9-4ced-a047-24954f4e8e33",
        "category": "personal",
        "status": "draft",
        "graph": {
            "nodes": [
                {
                    "id": "node_start",
                    "type": "start",
                    "position": {
                        "x": 100,
                        "y": 100
                    },
                    "deletable": false,
                    "data": {
                        "label": "Start",
                        "nodeType": "Start"
                    },
                    "width": 250,
                    "height": 130
                }
            ],
            "edges": []
        },
        "workflow_data": {}
    },
    {
        "id": "f15f01a7-43c0-4d06-9d93-9d9577d2defe",
        "name": "1: Prepare questions for AI",
        "owner_id": "common",
        "category": "common",
        "status": "draft",
        "graph": {
            "nodes": [
                {
                    "id": "node_start",
                    "type": "start",
                    "position": {
                        "x": 260,
                        "y": 380
                    },
                    "deletable": false,
                    "data": {
                        "label": "Start",
                        "nodeType": "Start"
                    },
                    "width": 250,
                    "height": 130,
                    "selected": false,
                    "positionAbsolute": {
                        "x": 260,
                        "y": 380
                    },
                    "dragging": false
                },
                {
                    "id": "node_1772720715257",
                    "type": "action",
                    "position": {
                        "x": 260,
                        "y": 540
                    },
                    "data": {
                        "nodeTypeId": "2301f433-3341-44f2-a679-1bf841bb7202",
                        "label": "Set value",
                        "category": "Data|Runtime",
                        "params": {
                            "Name": "_category",
                            "NewValue": "Q1",
                            "Update": false
                        },
                        "icon": "task"
                    },
                    "width": 250,
                    "height": 157,
                    "selected": false,
                    "positionAbsolute": {
                        "x": 260,
                        "y": 540
                    },
                    "dragging": false
                },
                {
                    "id": "node_1772720794068",
                    "type": "action",
                    "position": {
                        "x": 260,
                        "y": 1060
                    },
                    "data": {
                        "nodeTypeId": "c71008b9-9b88-4405-8780-53105361b7f8",
                        "label": "Prepare AI Question by Category",
                        "category": "Database",
                        "params": {},
                        "icon": "text"
                    },
                    "width": 250,
                    "height": 100,
                    "selected": false,
                    "positionAbsolute": {
                        "x": 260,
                        "y": 1060
                    },
                    "dragging": false
                },
                {
                    "id": "node_1772721277801",
                    "type": "action",
                    "position": {
                        "x": 260,
                        "y": 730
                    },
                    "data": {
                        "nodeTypeId": "2301f433-3341-44f2-a679-1bf841bb7202",
                        "label": "Set value",
                        "category": "Data|Runtime",
                        "params": {
                            "Name": "_session_expires_in_days",
                            "NewValue": "1",
                            "Update": false
                        },
                        "icon": "task"
                    },
                    "width": 250,
                    "height": 157,
                    "selected": false,
                    "positionAbsolute": {
                        "x": 260,
                        "y": 730
                    },
                    "dragging": false
                },
                {
                    "id": "node_1772721445632",
                    "type": "action",
                    "position": {
                        "x": 260,
                        "y": 920
                    },
                    "data": {
                        "nodeTypeId": "66171aa4-8781-4e88-bf92-ec2be6d01ba2",
                        "label": "Create or get session ID",
                        "category": "Database",
                        "params": {},
                        "icon": "text"
                    },
                    "width": 250,
                    "height": 100,
                    "selected": true,
                    "positionAbsolute": {
                        "x": 260,
                        "y": 920
                    },
                    "dragging": false
                }
            ],
            "edges": [
                {
                    "id": "e_node_start-node_1772720715257",
                    "source": "node_start",
                    "sourceHandle": null,
                    "target": "node_1772720715257",
                    "targetHandle": "top"
                },
                {
                    "id": "e_node_1772720715257-node_1772721277801",
                    "source": "node_1772720715257",
                    "sourceHandle": "output",
                    "target": "node_1772721277801",
                    "targetHandle": "top"
                },
                {
                    "id": "e_node_1772721277801-node_1772721445632",
                    "source": "node_1772721277801",
                    "sourceHandle": "output",
                    "target": "node_1772721445632",
                    "targetHandle": "top"
                },
                {
                    "source": "node_1772721445632",
                    "sourceHandle": "output",
                    "target": "node_1772720794068",
                    "targetHandle": "top",
                    "id": "e_node_1772721445632-node_1772720794068-1772721449428"
                }
            ]
        },
        "workflow_data": {}
    },
    {
        "id": "ae49675d-ec0c-4c84-a680-c49793c0ace6",
        "name": "2: Get response of AI",
        "owner_id": "common",
        "category": "common",
        "status": "draft",
        "graph": {
            "nodes": [
                {
                    "id": "node_start",
                    "type": "start",
                    "position": {
                        "x": 100,
                        "y": -150
                    },
                    "deletable": false,
                    "data": {
                        "label": "Start",
                        "nodeType": "Start"
                    },
                    "width": 250,
                    "height": 130,
                    "selected": false,
                    "positionAbsolute": {
                        "x": 100,
                        "y": -150
                    },
                    "dragging": false
                },
                {
                    "id": "node_1772719677851",
                    "type": "action",
                    "position": {
                        "x": 100,
                        "y": 10
                    },
                    "data": {
                        "nodeTypeId": "2301f433-3341-44f2-a679-1bf841bb7202",
                        "label": "Set value",
                        "category": "Data|Runtime",
                        "params": {
                            "Name": "_AIAnswer",
                            "NewValue": "Perplexity",
                            "Update": false
                        },
                        "icon": "task"
                    },
                    "width": 250,
                    "height": 157,
                    "selected": false,
                    "positionAbsolute": {
                        "x": 100,
                        "y": 10
                    },
                    "dragging": false
                },
                {
                    "id": "node_1772719685596",
                    "type": "action",
                    "position": {
                        "x": 100,
                        "y": 190
                    },
                    "data": {
                        "nodeTypeId": "2301f433-3341-44f2-a679-1bf841bb7202",
                        "label": "Set value",
                        "category": "Data|Runtime",
                        "params": {
                            "Name": "_AIModel",
                            "NewValue": "sonar",
                            "Update": false
                        },
                        "icon": "task"
                    },
                    "width": 250,
                    "height": 157,
                    "selected": false,
                    "positionAbsolute": {
                        "x": 100,
                        "y": 190
                    },
                    "dragging": false
                },
                {
                    "id": "node_1772720408927",
                    "type": "action",
                    "position": {
                        "x": 100,
                        "y": 370
                    },
                    "data": {
                        "nodeTypeId": "2301f433-3341-44f2-a679-1bf841bb7202",
                        "label": "Set value",
                        "category": "Data|Runtime",
                        "params": {
                            "Name": "_category",
                            "NewValue": "Q1",
                            "Update": false
                        },
                        "icon": "task"
                    },
                    "width": 250,
                    "height": 157,
                    "selected": false,
                    "positionAbsolute": {
                        "x": 100,
                        "y": 370
                    },
                    "dragging": false
                },
                {
                    "id": "node_1772720942577",
                    "type": "action",
                    "position": {
                        "x": 100,
                        "y": 1340
                    },
                    "data": {
                        "nodeTypeId": "94a06316-3627-4ab2-b95e-36a26fc8839a",
                        "label": "AI Answer on question",
                        "category": "AI",
                        "params": {},
                        "icon": "graph-2"
                    },
                    "width": 250,
                    "height": 100,
                    "selected": false,
                    "positionAbsolute": {
                        "x": 100,
                        "y": 1340
                    },
                    "dragging": false
                },
                {
                    "id": "node_1772721156466",
                    "type": "action",
                    "position": {
                        "x": 100,
                        "y": 1200
                    },
                    "data": {
                        "nodeTypeId": "21a0c4b5-f180-4072-aefc-a71be1193d3a",
                        "label": "Clear answers of model",
                        "category": "Database",
                        "params": {},
                        "icon": "text"
                    },
                    "width": 250,
                    "height": 100,
                    "selected": false,
                    "positionAbsolute": {
                        "x": 100,
                        "y": 1200
                    },
                    "dragging": false
                },
                {
                    "id": "node_1772721473562",
                    "type": "action",
                    "position": {
                        "x": 100,
                        "y": 570
                    },
                    "data": {
                        "nodeTypeId": "2301f433-3341-44f2-a679-1bf841bb7202",
                        "label": "Set value",
                        "category": "Data|Runtime",
                        "params": {
                            "Name": "_session_expires_in_days",
                            "NewValue": "1",
                            "Update": false
                        },
                        "icon": "task"
                    },
                    "width": 250,
                    "height": 157,
                    "selected": false,
                    "positionAbsolute": {
                        "x": 100,
                        "y": 570
                    },
                    "dragging": false
                },
                {
                    "id": "node_1772721492477",
                    "type": "action",
                    "position": {
                        "x": 100,
                        "y": 1050
                    },
                    "data": {
                        "nodeTypeId": "66171aa4-8781-4e88-bf92-ec2be6d01ba2",
                        "label": "Create or get session ID",
                        "category": "Database",
                        "params": {},
                        "icon": "text"
                    },
                    "width": 250,
                    "height": 100,
                    "selected": false,
                    "positionAbsolute": {
                        "x": 100,
                        "y": 1050
                    },
                    "dragging": false
                },
                {
                    "id": "node_1772722236707",
                    "type": "action",
                    "position": {
                        "x": 100,
                        "y": 790
                    },
                    "data": {
                        "nodeTypeId": "2301f433-3341-44f2-a679-1bf841bb7202",
                        "label": "Set value",
                        "category": "Data|Runtime",
                        "params": {
                            "Name": "_additional_query",
                            "NewValue": "With http links.",
                            "Update": false
                        },
                        "icon": "task"
                    },
                    "width": 250,
                    "height": 157,
                    "selected": false,
                    "dragging": false
                }
            ],
            "edges": [
                {
                    "id": "e_node_1772719677851-node_1772719685596",
                    "source": "node_1772719677851",
                    "sourceHandle": "output",
                    "target": "node_1772719685596",
                    "targetHandle": "top",
                    "selected": false
                },
                {
                    "id": "e_node_1772719685596-node_1772720408927",
                    "source": "node_1772719685596",
                    "sourceHandle": "output",
                    "target": "node_1772720408927",
                    "targetHandle": "top",
                    "selected": false
                },
                {
                    "source": "node_start",
                    "sourceHandle": "output",
                    "target": "node_1772719677851",
                    "targetHandle": "top",
                    "id": "e_node_start-node_1772719677851-1772720616808",
                    "selected": false
                },
                {
                    "source": "node_1772721156466",
                    "sourceHandle": "output",
                    "target": "node_1772720942577",
                    "targetHandle": "top",
                    "id": "e_node_1772721156466-node_1772720942577-1772721161659",
                    "selected": false
                },
                {
                    "id": "e_node_1772720408927-node_1772721473562",
                    "source": "node_1772720408927",
                    "sourceHandle": "output",
                    "target": "node_1772721473562",
                    "targetHandle": "top"
                },
                {
                    "id": "e_node_1772721473562-node_1772721492477",
                    "source": "node_1772721473562",
                    "sourceHandle": "output",
                    "target": "node_1772721492477",
                    "targetHandle": "top",
                    "selected": false
                },
                {
                    "source": "node_1772721492477",
                    "sourceHandle": "output",
                    "target": "node_1772721156466",
                    "targetHandle": "top",
                    "id": "e_node_1772721492477-node_1772721156466-1772721497427",
                    "selected": false
                },
                {
                    "id": "e_node_1772721473562-node_1772722236707",
                    "source": "node_1772721473562",
                    "sourceHandle": "output",
                    "target": "node_1772722236707",
                    "targetHandle": "top"
                }
            ]
        },
        "workflow_data": {}
    }
]
