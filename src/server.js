"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var cors_1 = require("cors");
var fs_1 = require("fs");
var path_1 = require("path");
var url_1 = require("url");
var app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.post('/api/validate-industry', function (req, res) {
    var company = req.body.company;
    console.log({ company: company });
    var foodCompanies = ['Nestle', 'PepsiCo', 'Coca-Cola', 'ABCD'];
    var match = foodCompanies.includes(company);
    res.json({
        industryMatch: match,
        companyOverview: match ? "Overview of ".concat(company) : 'Generic company'
    });
});
app.get('/api/ping', function (req, res) {
    res.json({ message: 'pong', timestamp: new Date().toISOString() });
});
app.post('/api/validate-industry', function (req, res) {
    var company = req.body.company;
    console.log({ company: company });
    var foodCompanies = ['Nestle', 'PepsiCo', 'Coca-Cola', 'ABCD'];
    var match = foodCompanies.includes(company);
    res.json({
        industryMatch: match,
        companyOverview: match ? "Overview of ".concat(company) : 'Generic company'
    });
});
// Properly setup __dirname in ES module
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = path_1.default.dirname(__filename);
app.post('/api/report', function (req, res) {
    var _a = req.body, userName = _a.userName, companyName = _a.companyName, role = _a.role, objective = _a.objective, idealOutput = _a.idealOutput, industryConfirmed = _a.industryConfirmed, companyOverview = _a.companyOverview, transcript = _a.transcript;
    var report = {
        userName: userName,
        companyName: companyName,
        role: role,
        objective: objective,
        industryConfirmed: industryConfirmed,
        idealOutput: idealOutput,
        companyOverview: companyOverview,
    };
    var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    var reportDir = path_1.default.join(__dirname, 'reports');
    var reportPath = path_1.default.join(reportDir, "report-".concat(timestamp, ".json"));
    var transcriptPath = path_1.default.join(reportDir, "transcript-".concat(timestamp, ".txt"));
    // Ensure directory exists
    if (!fs_1.default.existsSync(reportDir)) {
        fs_1.default.mkdirSync(reportDir, { recursive: true });
    }
    fs_1.default.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    fs_1.default.writeFileSync(transcriptPath, transcript || '');
    res.json({ message: 'Report saved', report: report });
});
app.listen(4567, function () { return console.log('Mock API running on port 4567'); });
