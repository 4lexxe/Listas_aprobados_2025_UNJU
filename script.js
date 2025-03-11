// Variables
let pdfDoc = null,
    pageNum = 1,
    pageRendering = false,
    pageNumPending = null,
    scale = 1.5,
    searchResults = [],
    currentResultIndex = -1,
    currentSearchTerm = '';

const canvas = document.getElementById('pdf-render'),
    ctx = canvas.getContext('2d');

// Cargar PDF
const loadPDF = async () => {
    try {
        // Ruta al archivo PDF
        const loadingTask = pdfjsLib.getDocument('./Lista_de_aprobados_de_examen_de_matemática_8-03-2025_(1)[1].pdf');
        pdfDoc = await loadingTask.promise;
        
        // Actualizar número total de páginas
        document.getElementById('page_count').textContent = pdfDoc.numPages;
        
        // Renderizar primera página
        renderPage(pageNum);
    } catch (error) {
        console.error('Error al cargar el PDF:', error);
        alert('Error al cargar el documento PDF. Verifica que el archivo exista en la ubicación correcta.');
    }
};

// Función para resaltar texto encontrado
async function highlightText(page, viewport) {
    if (!currentSearchTerm) return;

    const textContent = await page.getTextContent();
    const textItems = textContent.items;
    
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ffeb3b';

    for (let item of textItems) {
        const text = item.str.toLowerCase();
        const searchTerm = currentSearchTerm.toLowerCase();
        
        if (text.includes(searchTerm)) {
            const transform = viewport.transform;
            const [a, b, c, d, e, f] = item.transform;
            
            const x = transform[0] * a + transform[2] * b + transform[4];
            const y = transform[1] * a + transform[3] * b + transform[5];
            
            ctx.fillRect(
                x,
                y - item.height,
                item.width * viewport.scale,
                item.height * 1.5
            );
        }
    }
    
    ctx.restore();
}

// Renderizar página específica
const renderPage = (num) => {
    pageRendering = true;
    
    // Obtener página
    pdfDoc.getPage(num).then(async (page) => {
        // Ajustar el tamaño del canvas según la escala
        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Renderizar PDF en el canvas
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        
        const renderTask = page.render(renderContext);
        
        // Cuando termine el renderizado
        renderTask.promise.then(async () => {
            // Resaltar el texto si hay una búsqueda activa
            await highlightText(page, viewport);
            
            pageRendering = false;
            
            if (pageNumPending !== null) {
                // Se solicitó otra página mientras se renderizaba
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });
    
    // Actualizar el número de página actual
    document.getElementById('page_num').value = num;
};

// Página anterior
document.getElementById('prev').addEventListener('click', () => {
    if (pageNum <= 1) {
        return;
    }
    pageNum--;
    queueRenderPage(pageNum);
});

// Página siguiente
document.getElementById('next').addEventListener('click', () => {
    if (pageNum >= pdfDoc.numPages) {
        return;
    }
    pageNum++;
    queueRenderPage(pageNum);
});

// Ir a página específica
document.getElementById('page_num').addEventListener('change', (e) => {
    const newPage = parseInt(e.target.value);
    if (newPage > 0 && newPage <= pdfDoc.numPages) {
        pageNum = newPage;
        queueRenderPage(pageNum);
    } else {
        alert(`Ingrese un número entre 1 y ${pdfDoc.numPages}`);
        e.target.value = pageNum;
    }
});

// Zoom In
document.getElementById('zoomIn').addEventListener('click', () => {
    if (scale < 3.0) {
        scale += 0.25;
        queueRenderPage(pageNum);
    }
});

// Zoom Out
document.getElementById('zoomOut').addEventListener('click', () => {
    if (scale > 0.5) {
        scale -= 0.25;
        queueRenderPage(pageNum);
    }
});

// Poner página en cola para renderizar
const queueRenderPage = (num) => {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
};

// Iniciar la carga del PDF cuando se cargue la página
window.addEventListener('load', loadPDF);

// Función para procesar el texto y extraer los datos estructurados
function processTextContent(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const results = [];
    let processingNoAsistencia = false;
    
    // Depuración
    console.log('Texto a procesar:', text);
    
    for (let line of lines) {
        line = line.trim();
        
        // Detectar sección de no asistencia
        if (line.includes('Alumnos que no podían rendir')) {
            processingNoAsistencia = true;
            continue;
        }
        
        // Ignorar líneas de encabezado
        if (line.includes('Apellido y Nombre') || 
            line.includes('Nro de DNI') || 
            line.startsWith('Alumnos que') ||
            line.length < 10) continue;
        
        console.log('Procesando línea:', line);
        
        // Procesar alumnos aprobados
        let match = line.match(/(\d+)\s+([\wáéíóúÁÉÍÓÚñÑ\s,\.]+)\s+(\d{8})\s+(.*?)Aprobado/);
        
        if (match) {
            const result = {
                numero: match[1],
                nombreApellido: match[2].trim(),
                dni: match[3],
                localidad: match[4].trim(),
                estado: 'Aprobado'
            };
            console.log('Resultado procesado (Aprobado):', result);
            results.push(result);
            continue;
        }
        
        // Procesar alumnos que no podían rendir
        if (processingNoAsistencia) {
            match = line.match(/(\d+)\s+([\wáéíóúÁÉÍÓÚñÑ\s,\.]+)\s+(\d+)/);
            if (match) {
                const result = {
                    numero: match[1],
                    nombreApellido: match[2].trim(),
                    dni: match[3],
                    localidad: '-',
                    estado: 'No podía rendir'
                };
                console.log('Resultado procesado (No podía rendir):', result);
                results.push(result);
            }
        }
    }
    
    return results;
}

// Función para actualizar la tabla de resultados
function updateResultsTable(results) {
    const tableContainer = document.getElementById('results-table-container');
    const tableBody = document.getElementById('results-table-body');
    const numeroColumn = document.querySelector('.numero-column');
    tableBody.innerHTML = '';
    
    if (results.length === 0) {
        // Ocultar la columna de número cuando no hay resultados
        if (numeroColumn) numeroColumn.style.display = 'none';
        
        // Mostrar mensaje de "No aprobado o no registrado" en la tabla
        tableContainer.style.display = 'block';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="4" class="text-center">
                <span class="badge bg-danger">No aprobado o no registrado</span>
            </td>
        `;
        tableBody.appendChild(row);
        return;
    }
    
    // Mostrar la columna de número cuando hay resultados
    if (numeroColumn) numeroColumn.style.display = '';
    
    // Ordenar resultados por número
    results.sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
    
    results.forEach(result => {
        const row = document.createElement('tr');
        const badgeClass = result.estado === 'Aprobado' ? 'bg-success' : 
                          result.estado === 'No podía rendir' ? 'bg-warning text-dark' : 'bg-danger';
        
        row.innerHTML = `
            <td class="text-center">${result.numero}</td>
            <td>${result.nombreApellido}</td>
            <td class="text-center">${result.dni}</td>
            <td>${result.localidad}</td>
            <td class="text-center"><span class="badge ${badgeClass}">${result.estado}</span></td>
        `;
        tableBody.appendChild(row);
    });
    
    tableContainer.style.display = 'block';
}

// Función para buscar texto en el PDF
async function searchPDF(searchTerm) {
    searchResults = [];
    currentResultIndex = -1;
    currentSearchTerm = searchTerm;
    document.getElementById('results-count').textContent = '0';
    document.getElementById('prev-result').disabled = true;
    document.getElementById('next-result').disabled = false;
    
    if (!searchTerm.trim()) {
        currentSearchTerm = '';
        updateResultsTable([]);
        queueRenderPage(pageNum);
        return;
    }
    
    document.getElementById('search-status').classList.remove('d-none');
    
    try {
        let allResults = [];
        
        for (let pageIndex = 1; pageIndex <= pdfDoc.numPages; pageIndex++) {
            const page = await pdfDoc.getPage(pageIndex);
            const textContent = await page.getTextContent();
            
            // Mejorar la extracción del texto preservando el formato de tabla
            let text = '';
            let lastY;
            let currentLine = '';
            
            // Ordenar los items por posición Y y luego X
            const sortedItems = textContent.items.sort((a, b) => {
                if (Math.abs(a.transform[5] - b.transform[5]) < 5) {
                    return a.transform[4] - b.transform[4];
                }
                return b.transform[5] - a.transform[5];
            });
            
            // Construir el texto preservando el formato de tabla
            for (let i = 0; i < sortedItems.length; i++) {
                const item = sortedItems[i];
                if (lastY && Math.abs(lastY - item.transform[5]) > 5) {
                    text += currentLine.trim() + '\n';
                    currentLine = '';
                }
                if (currentLine && !currentLine.endsWith(' ')) {
                    currentLine += ' ';
                }
                currentLine += item.str;
                lastY = item.transform[5];
            }
            if (currentLine) {
                text += currentLine.trim();
            }
            
            console.log('Texto extraído de la página:', text);
            
            // Procesar el texto para obtener datos estructurados
            const processedResults = processTextContent(text);
            console.log('Resultados procesados:', processedResults);
            
            // Filtrar resultados según el término de búsqueda
            const filteredResults = processedResults.filter(result => {
                const searchTermLower = searchTerm.toLowerCase();
                return result.nombreApellido.toLowerCase().includes(searchTermLower) ||
                       result.dni.includes(searchTerm) ||
                       result.localidad.toLowerCase().includes(searchTermLower);
            });
            
            if (filteredResults.length > 0) {
                allResults = [...allResults, ...filteredResults];
                searchResults.push({
                    page: pageIndex,
                    text: text
                });
            }
        }
        
        console.log('Resultados totales encontrados:', allResults);
        document.getElementById('results-count').textContent = allResults.length;
        updateResultsTable(allResults);
        
        if (searchResults.length > 0) {
            document.getElementById('prev-result').disabled = false;
            document.getElementById('next-result').disabled = false;
            showNextResult();
        } else {
            queueRenderPage(pageNum);
        }
    } catch (error) {
        console.error('Error en la búsqueda:', error);
    }
    
    document.getElementById('search-status').classList.add('d-none');
}

// Función para mostrar el siguiente resultado
function showNextResult() {
    if (searchResults.length === 0) return;
    
    currentResultIndex = (currentResultIndex + 1) % searchResults.length;
    const result = searchResults[currentResultIndex];
    pageNum = result.page;
    queueRenderPage(pageNum);
}

// Función para mostrar el resultado anterior
function showPrevResult() {
    if (searchResults.length === 0) return;
    
    currentResultIndex = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
    const result = searchResults[currentResultIndex];
    pageNum = result.page;
    queueRenderPage(pageNum);
}

// Agregar event listeners para la búsqueda
document.getElementById('search-button').addEventListener('click', () => {
    const searchTerm = document.getElementById('search-input').value;
    searchPDF(searchTerm);
});

document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const searchTerm = document.getElementById('search-input').value;
        searchPDF(searchTerm);
    }
});

document.getElementById('next-result').addEventListener('click', showNextResult);
document.getElementById('prev-result').addEventListener('click', showPrevResult);
