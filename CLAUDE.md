#Claude Project Instructions
​Always follow these rules in this project:
​For any project architecture, authentication, routing, backend, frontend, Prisma, Supabase, or file-structure question:
​First read graphify-out/GRAPH_REPORT.md.
​Then check dependency-report.html or graphify-out/graph.json to audit code connections. Look specifically for any unlinked files, missing imports, or state updates that are not connected between the User modules and the Dashboard.
​Then open only the specific source files that are relevant.
​Do not read graphify-out/graph.html unless the user explicitly asks. graph.html is only for browser visualization and is too large.
​Do not scan the whole project unless absolutely necessary. Use the Graphify report and dependency-report first to find any disconnected logic or missing data flows.
​Before editing files, explain what you found (especially if you noticed a missing connection that should be linked) and ask for confirmation.
​Keep explanations simple and clear because the user is still learning.