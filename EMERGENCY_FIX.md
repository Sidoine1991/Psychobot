# 🆘 EMERGENCY FIX — PsychoBot Service Down

**Status**: Service not responding  
**Commit**: b62969e (latest)  
**Issue**: Likely deployment failed or service crashed

---

## 🚀 **SOLUTION IMMÉDIATE**

### **Option 1: Via Render Dashboard (FASTEST)**

1. Go to: https://dashboard.render.com/
2. Find "Psychobot" service
3. Click **"Restart Service"** button
4. Wait 2-3 minutes
5. Try: https://psychobot-1si7.onrender.com/ping

### **Option 2: Manual Render Deployment**

```bash
# From Render Dashboard:
# Service → Manual Deploy → Deploy latest commit
```

### **Option 3: Force Clean Rebuild**

```bash
# If restart doesn't work:
# 1. Service Settings
# 2. Environment → Add dummy var (e.g., REBUILD=1)
# 3. Save (triggers redeploy)
# 4. Remove dummy var after deploy finishes
```

---

## 🔧 **If Still Down After Restart**

Check what's wrong:

```bash
# Get service ID first (from dashboard URL)
# Example: srv-d7rgonbbc2fs738bthig-hibernate-8c665cf6f-r4rr9

# Then check logs:
curl -s -H "Authorization: Bearer YOUR_API_KEY" \
  "https://api.render.com/v1/services/SERVICE_ID/logs" | jq '.'
```

### **Common Deployment Errors**

| Error | Fix |
|-------|-----|
| `Error: listen EADDRINUSE` | Port 10000 already in use → Restart fresh |
| `SyntaxError in index.js` | Syntax error in code → Check line number |
| `Cannot find module` | Missing dependency → Run `npm install` |
| `Build failed` | npm install failed → Check package.json |

---

## 📋 **Troubleshooting Checklist**

- [ ] Service status is 🟢 Green in Render dashboard?
- [ ] Tried `/ping` endpoint?
- [ ] Tried restarting service?
- [ ] Checked logs for specific error messages?
- [ ] Tried force rebuild with dummy env var?

---

## 🎯 **NEXT STEPS**

1. **Go to Render Dashboard NOW**
2. **Click "Restart Service"**
3. **Wait 3 minutes**
4. **Test**: `https://psychobot-1si7.onrender.com/ping`
5. **If still down**: Tell me the EXACT error from logs

---

**Most common fix**: Just **Restart Service** button in Render Dashboard

99% of the time that solves it! 🚀

