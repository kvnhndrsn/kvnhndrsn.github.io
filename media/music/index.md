---
layout: default
title: My Music Collection
---

<style>
    .container { max-width: 1100px; margin: 40px auto; padding: 0 20px; }
    input#search {
        width: 100%; padding: 12px; margin-bottom: 20px;
        background: #333; border: 1px solid #444; color: white;
        border-radius: 4px;
    }
    table { width: 100%; border-collapse: collapse; background: #252525; color: #eee; }
    th { background: #333; color: #00d4ff; padding: 12px; text-align: left; cursor: pointer; }
    td { padding: 4px; border-bottom: 1px solid #444; }
    tr:hover { background: #2d2d2d; }
    
    /* Style for the YouTube Link */
    .yt-link {
        display: inline-block;
        padding: 4px 10px;
        background: #cc0000;
        color: white !important;
        text-decoration: none;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: bold;
    }
    .yt-link:hover { background: #ff0000; }
    .rating-col { color: #ffcc00; font-weight: bold; }
</style>

<div class="container">
    <h1><a href="/media/movies">MOVIES</a> // <a href="/media/television">TELEVISION</a> // MUSIC</h1>
    <input type="text" id="search" placeholder="Search by artist, title, or rating..." onkeyup="filterTable()">
    <table id="musicTable">
        <thead>
            <tr>
                <th onclick="sortTable(0)">Artist</th>
                <th onclick="sortTable(1)">Title</th>
                <th onclick="sortTable(2)">YouTube</th>
                <th onclick="sortTable(3)">Rating</th>
            </tr>
        </thead>
        <tbody id="tableBody">
            <tr><td colspan="5">Loading music...</td></tr>
        </tbody>
    </table>
</div>

<script>
    let musicData = [];

    async function loadMusic() {
        const tableBody = document.getElementById('tableBody');
        try {
            const response = await fetch('/media/music/music.csv'); // Use your CSV filename here
            if (!response.ok) throw new Error('CSV not found');

            const text = await response.text();
            const rows = text.split('\n').slice(1).filter(row => row.trim() !== '');
            
            musicData = rows.map(row => {
                const cols = row.split(',');
                return {
                    artist: cols[0] || '',
                    title: cols[1] || '',
                    link: cols[2] || '',
                    rating: cols[3] || '',
                    again: cols[4] || ''
                };
            });

            renderTable(musicData);
        } catch (error) {
            tableBody.innerHTML = `<tr><td colspan="5" style="color:red;">Error: ${error.message}</td></tr>`;
        }
    }

    function renderTable(data) {
        const tableBody = document.getElementById('tableBody');
        tableBody.innerHTML = ""; 

        data.forEach(item => {
            const tr = document.createElement('tr');
            
            // This is the part that creates the actual link
            const youtubeCell = item.link 
                ? `<a href="${item.link}" target="_blank" class="yt-link">Watch</a>` 
                : '-';

            tr.innerHTML = `
                <td>${item.artist}</td>
                <td><strong>${item.title}</strong></td>
                <td>${youtubeCell}</td>
                <td class="rating-col">${item.rating}</td>
                <td>${item.again}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    let sortDirection = true;
    function sortTable(columnIndex) {
        sortDirection = !sortDirection;
        const keys = ['artist', 'title', 'link', 'rating', 'again'];
        const key = keys[columnIndex];

        musicData.sort((a, b) => {
            let valA = a[key].toLowerCase();
            let valB = b[key].toLowerCase();
            return sortDirection ? valA.localeCompare(valB) : valB.localeCompare(valA);
        });

        renderTable(musicData);
    }

    function filterTable() {
        const input = document.getElementById('search').value.toLowerCase();
        const filtered = musicData.filter(m => 
            Object.values(m).some(val => val.toLowerCase().includes(input))
        );
        renderTable(filtered);
    }

    document.addEventListener('DOMContentLoaded', loadMusic);
</script>
