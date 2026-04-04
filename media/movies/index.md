---
layout: default
title: My Movie Ratings
---

<style>
    .movie-container { max-width: 1000px; margin: 40px auto; padding: 0 20px; font-family: sans-serif; }
    
    input#search {
        width: 100%; padding: 12px; margin-bottom: 20px;
        background: #77777777; border: 1px solid #444; color: white;
        border-radius: 4px; font-size: 1rem;
    }

    table { width: 100%; border-collapse: collapse; background: #77777777; color: var(--text-color); }
    
    th { 
        background: #77777777; 
        color: #00d4ff; 
        padding: 10px; 
        text-align: left; 
        cursor: pointer; 
        user-select: none;
        position: relative;
    }

    /* Add sort arrows */
    th::after { content: ' ↕'; font-size: 0.7rem; opacity: 0.5; }
    
    td { padding: 4px; border-bottom: 1px solid #444; }
    tr:hover { background: #2d2d2d; }
    
    .rating-col { color: #ffcc00; font-weight: bold; }
</style>

<div class="movie-container">
    <h1>MOVIES // <a href="/media/television">TELEVISION</a> // <a href="/media/music">MUSIC</a></h1>
    <input type="text" id="search" placeholder="Filter by name, year, or rating..." onkeyup="filterTable()">
    <table id="movieTable">
        <thead>
            <tr>
                <th onclick="sortTable(0)">Year</th>
                <th onclick="sortTable(1)">Title</th>
                <th onclick="sortTable(2)">Rating</th>
                <th onclick="sortTable(3)">Watch Again</th>
                <th onclick="">Notes</th>
            </tr>
        </thead>
        <tbody id="tableBody">
            <tr><td colspan="4">Loading movies...</td></tr>
        </tbody>
    </table>
</div>

<script>
    let movieData = []; // Store data globally for sorting

    async function loadMovies() {
        const tableBody = document.getElementById('tableBody');
        try {
            const response = await fetch('/media/movies/movies.csv');
            if (!response.ok) throw new Error('CSV not found');

            const text = await response.text();
            // Parse CSV rows into an array of objects
            const rows = text.split('\n').slice(1).filter(row => row.trim() !== '');
            
            movieData = rows.map(row => {
                const cols = row.split(',');
                return {
                    year: cols[0] || '',
                    title: cols[1] || '',
                    rating: cols[2] || '',
                    again: cols[3] || '',
                    notes: cols[4] || ''
                };
            });

            renderTable(movieData);
        } catch (error) {
            tableBody.innerHTML = `<tr><td colspan="4" style="color:red;">Error: ${error.message}</td></tr>`;
        }
    }

    function renderTable(data) {
        const tableBody = document.getElementById('tableBody');
        tableBody.innerHTML = ""; 

        data.forEach(movie => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${movie.year}</td>
                <td><strong>${movie.title}</strong></td>
                <td class="rating-col">${movie.rating}</td>
                <td>${movie.again}</td>
                <td>${movie.notes}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // Sorting Logic
    let sortDirection = true;
    function sortTable(columnIndex) {
        sortDirection = !sortDirection;
        const keys = ['year', 'title', 'rating', 'again', 'notes'];
        const key = keys[columnIndex];

        movieData.sort((a, b) => {
            let valA = a[key].toLowerCase();
            let valB = b[key].toLowerCase();

            // Handle numeric sorting for Year and Rating
            if (key === 'year' || key === 'rating') {
                return sortDirection ? parseFloat(valA) - parseFloat(valB) : parseFloat(valB) - parseFloat(valA);
            }

            return sortDirection 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        });

        renderTable(movieData);
    }

    function filterTable() {
        const input = document.getElementById('search').value.toLowerCase();
        const filtered = movieData.filter(m => 
            Object.values(m).some(val => val.toLowerCase().includes(input))
        );
        renderTable(filtered);
    }

    document.addEventListener('DOMContentLoaded', loadMovies);
</script>
