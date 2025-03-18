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

// Definir rutas de los PDFs disponibles
const pdfFiles = {
    primera: './Lista_de_aprobados_de_examen_de_matemática_8-03-2025_(1)[1].pdf',
    segunda: './Lista_de_Aprobados_exámen_de_Matemática_segunda_fecha.pdf'
};

// Información de los PDFs
const pdfInfo = {
    primera: {
        title: 'Lista de aprobados de examen de matemática',
        date: '8-03-2025'
    },
    segunda: {
        title: 'Lista de aprobados de examen de matemática - Recuperatorio',
        date: 'Segunda fecha (14/03)'
    }
};

// PDF actual seleccionado
let currentPdfSelection = 'primera';

// Actualizar información del PDF en la interfaz
function updatePdfInfo(selection) {
    const info = pdfInfo[selection];
    document.getElementById('header-title').textContent = info.title;
    
    // Verificar primero si los elementos existen antes de manipularlos
    // Esto arregla el error: Cannot read properties of null (reading 'classList')
    const tabPrimera = document.getElementById('primera-tab');
    const tabSegunda = document.getElementById('segunda-tab');
    
    if (tabPrimera && tabSegunda) {
        if (selection === 'primera') {
            tabPrimera.classList.add('active');
            tabSegunda.classList.remove('active');
        } else {
            tabPrimera.classList.remove('active');
            tabSegunda.classList.add('active');
        }
    }
}

// Cargar PDF
const loadPDF = async (pdfKey = currentPdfSelection) => {
    currentPdfSelection = pdfKey;
    updatePdfInfo(pdfKey);
    
    try {
        // Ruta al archivo PDF seleccionado
        const pdfPath = pdfFiles[pdfKey];
        const loadingTask = pdfjsLib.getDocument(pdfPath);
        pdfDoc = await loadingTask.promise;
        
        // Actualizar número total de páginas
        document.getElementById('page_count').textContent = pdfDoc.numPages;
        
        // Resetear página a la primera al cambiar de documento
        pageNum = 1;
        
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
window.addEventListener('load', () => {
    loadPDF();
    updateVisitCount();
    
    // Configurar evento para cambio de pestañas
    const tabElements = document.querySelectorAll('#pdfTabs button[role="tab"]');
    tabElements.forEach(tab => {
        tab.addEventListener('click', function (event) {
            const pdfKey = this.getAttribute('data-pdf');
            if (pdfKey && currentPdfSelection !== pdfKey) {
                // Actualizar clases de pestañas
                document.querySelectorAll('#pdfTabs button').forEach(t => {
                    t.classList.remove('active');
                });
                this.classList.add('active');
                
                loadPDF(pdfKey);
                
                // Resetear la búsqueda actual al cambiar de documento
                searchResults = [];
                currentResultIndex = -1;
                currentSearchTerm = '';
                document.getElementById('search-input').value = '';
                document.getElementById('results-count').textContent = '0';
                document.getElementById('prev-result').disabled = true;
                document.getElementById('next-result').disabled = true;
                document.getElementById('results-table-container').style.display = 'none';
            }
        });
    });
    
    // Configurar evento para alternar visibilidad del PDF
    const togglePdfBtn = document.getElementById('toggle-pdf-view');
    if (togglePdfBtn) {
        togglePdfBtn.addEventListener('click', function() {
            const pdfContainer = document.querySelector('.pdf-container');
            const pdfIcon = this.querySelector('i');
            
            if (document.body.classList.contains('pdf-hidden')) {
                document.body.classList.remove('pdf-hidden');
                pdfIcon.classList.remove('bi-eye');
                pdfIcon.classList.add('bi-eye-slash');
                this.setAttribute('title', 'Ocultar PDF');
            } else {
                document.body.classList.add('pdf-hidden');
                pdfIcon.classList.remove('bi-eye-slash');
                pdfIcon.classList.add('bi-eye');
                this.setAttribute('title', 'Mostrar PDF');
            }
        });
    }
});

// Función para procesar el texto y extraer los datos estructurados
function processTextContent(text, pdfKey) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const results = [];
    let processingNoAsistencia = false;
    
    // Depuración
    console.log('Texto a procesar:', text);
    console.log('PDF origen:', pdfKey);
    
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
            line.includes('Exámen de Matemática') ||
            line.includes('Condición') ||
            line.length < 10) continue;
        
        console.log('Procesando línea:', line);
        
        // Diferentes patrones según el documento
        let match = null;
        
        // Patrón para el primer PDF - alumnos aprobados
        if (pdfKey === 'primera') {
            match = line.match(/(\d+)\s+([\wáéíóúÁÉÍÓÚñÑ\s,\.]+)\s+(\d{8})\s+(.*?)Aprobado/);
            
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
        } 
        // Patrón para el segundo PDF - formato diferente
        else if (pdfKey === 'segunda') {
            // Intentar capturar el patrón específico del segundo PDF
            // Patrón para líneas como: "1 Acosta, Jonas Imanol 45762439 San Pedro APROBADO"
            match = line.match(/^(\d+)\s+([\wáéíóúÁÉÍÓÚñÑ\s,\.]+)\s+(\d{8})\s+(.*?)APROBADO$/);
            
            if (match) {
                const result = {
                    numero: match[1],
                    nombreApellido: match[2].trim(),
                    dni: match[3],
                    localidad: match[4].trim(),
                    estado: 'Aprobado'
                };
                console.log('Resultado procesado (APROBADO - segundo PDF):', result);
                results.push(result);
                continue;
            }
        }
        
        // Patrón alternativo para casos donde hay problemas con el formato
        if (!match) {
            // Un patrón más flexible para detectar DNI de 8 dígitos y palabras como APROBADO/Aprobado
            match = line.match(/(\d+)\s+([\wáéíóúÁÉÍÓÚñÑ\s,\.]+)\s+(\d{7,8})\s+(.*?)(APROBADO|Aprobado)/i);
            
            if (match) {
                const result = {
                    numero: match[1],
                    nombreApellido: match[2].trim(),
                    dni: match[3],
                    localidad: match[4].trim(),
                    estado: 'Aprobado'
                };
                console.log('Resultado procesado (patrón alternativo):', result);
                results.push(result);
                continue;
            }
        }
        
        // Procesar alumnos que no podían rendir (solo en primer PDF)
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
            <td colspan="5" class="text-center">
                <span class="badge bg-danger">No aprobado o no registrado</span>
            </td>
        `;
        tableBody.appendChild(row);
        return;
    }
    
    // Mostrar la columna de número cuando hay resultados
    if (numeroColumn) numeroColumn.style.display = '';
    
    // Ordenar resultados primero por documento y luego por número
    results.sort((a, b) => {
        if (a.sourcePdf !== b.sourcePdf) {
            return a.sourcePdf === 'primera' ? -1 : 1;
        }
        return parseInt(a.numero) - parseInt(b.numero);
    });
    
    results.forEach(result => {
        const row = document.createElement('tr');
        const badgeClass = result.estado === 'Aprobado' ? 'bg-success' : 
                          result.estado === 'No podía rendir' ? 'bg-warning text-dark' : 'bg-danger';
        
        // Determinar si el resultado es del documento actual o del otro
        const isCurrentPdf = result.sourcePdf === currentPdfSelection;
        const rowClass = isCurrentPdf ? '' : 'table-info';
        
        row.className = rowClass;
        row.innerHTML = `
            <td class="text-center">${result.numero}</td>
            <td>${result.nombreApellido}</td>
            <td class="text-center">${result.dni}</td>
            <td>${result.localidad}</td>
            <td class="text-center">
                <span class="badge ${badgeClass}">${result.estado}</span>
                ${result.sourcePdf !== currentPdfSelection ? 
                    `<span class="badge bg-info ms-1" title="Encontrado en: ${result.sourceName}">
                        <i class="bi bi-file-earmark-pdf"></i>
                    </span>` : ''}
            </td>
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
    document.getElementById('search-status').textContent = 'Buscando...';
    document.getElementById('search-status').classList.add('searching');
    
    // Cuando hay una búsqueda activa, podemos ocultar automáticamente el PDF si hay resultados
    // Este comportamiento es opcional, se puede comentar si no se desea
    // document.body.classList.add('pdf-hidden');
    // const togglePdfBtn = document.getElementById('toggle-pdf-view');
    // if (togglePdfBtn) {
    //     const pdfIcon = togglePdfBtn.querySelector('i');
    //     pdfIcon.classList.remove('bi-eye-slash');
    //     pdfIcon.classList.add('bi-eye');
    //     togglePdfBtn.setAttribute('title', 'Mostrar PDF');
    // }
    
    try {
        let allResults = [];
        // Verificar si el checkbox existe antes de leer su propiedad
        // Esto arregla el error: Cannot read properties of null (reading 'checked')
        const searchBothCheckbox = document.getElementById('search-both-pdfs');
        const searchInBoth = searchBothCheckbox ? searchBothCheckbox.checked : true;
        
        // Si se busca en ambos documentos o solo en el actual
        const pdfKeysToSearch = searchInBoth ? ['primera', 'segunda'] : [currentPdfSelection];
        
        for (const pdfKey of pdfKeysToSearch) {
            // Cargar el PDF si no es el actual
            let tempPdfDoc;
            if (pdfKey === currentPdfSelection) {
                tempPdfDoc = pdfDoc;
            } else {
                document.getElementById('search-status').textContent = `Buscando en ${pdfInfo[pdfKey].title}...`;
                const pdfPath = pdfFiles[pdfKey];
                const loadingTask = pdfjsLib.getDocument(pdfPath);
                tempPdfDoc = await loadingTask.promise;
            }
            
            // Realizar la búsqueda en el PDF
            for (let pageIndex = 1; pageIndex <= tempPdfDoc.numPages; pageIndex++) {
                const page = await tempPdfDoc.getPage(pageIndex);
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
                
                // Procesar el texto para obtener datos estructurados
                const processedResults = processTextContent(text, pdfKey);
                
                // Filtrar resultados según el término de búsqueda
                const filteredResults = processedResults.filter(result => {
                    const searchTermLower = searchTerm.toLowerCase();
                    return result.nombreApellido.toLowerCase().includes(searchTermLower) ||
                           result.dni.includes(searchTerm) ||
                           (result.localidad && result.localidad.toLowerCase().includes(searchTermLower));
                });
                
                // Añadir información del PDF donde se encontró
                const resultsWithSource = filteredResults.map(result => ({
                    ...result,
                    sourcePdf: pdfKey,
                    sourceName: pdfInfo[pdfKey].title
                }));
                
                if (filteredResults.length > 0) {
                    allResults = [...allResults, ...resultsWithSource];
                    searchResults.push({
                        page: pageIndex,
                        text: text,
                        pdfKey: pdfKey
                    });
                }
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
        
        return allResults;
    } catch (error) {
        console.error('Error en la búsqueda:', error);
        return [];
    } finally {
        document.getElementById('search-status').classList.remove('searching');
        document.getElementById('search-status').classList.add('d-none');
    }
}

// Función para mostrar el siguiente resultado
function showNextResult() {
    if (searchResults.length === 0) return;
    
    currentResultIndex = (currentResultIndex + 1) % searchResults.length;
    const result = searchResults[currentResultIndex];
    
    // Verificar si el resultado está en otro PDF
    if (result.pdfKey && result.pdfKey !== currentPdfSelection) {
        loadPDF(result.pdfKey).then(() => {
            pageNum = result.page;
            queueRenderPage(pageNum);
        });
    } else {
        pageNum = result.page;
        queueRenderPage(pageNum);
    }
}

// Función para mostrar el resultado anterior
function showPrevResult() {
    if (searchResults.length === 0) return;
    
    currentResultIndex = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
    const result = searchResults[currentResultIndex];
    
    // Verificar si el resultado está en otro PDF
    if (result.pdfKey && result.pdfKey !== currentPdfSelection) {
        loadPDF(result.pdfKey).then(() => {
            pageNum = result.page;
            queueRenderPage(pageNum);
        });
    } else {
        pageNum = result.page;
        queueRenderPage(pageNum);
    }
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

// Contador de visitas
async function updateVisitCount() {
    try {
        const response = await fetch('https://api.countapi.xyz/hit/listas2025-alexxe/visits');
        const data = await response.json();
        document.getElementById('visits').innerText = data.value.toLocaleString();
    } catch (error) {
        console.error('Error al actualizar el contador de visitas:', error);
        document.getElementById('visits').innerText = 'Error';
    }
}
