import sys,math
sys.path.insert(0,'.')
from px import *
ST={'hp':['#3a0812','#7a0f1d','#b81d2c','#e53a3f','#ff7f73','#ffd2c8'],
'food':['#3a1a05','#7a3a08','#b8620f','#e8902a','#ffc061','#ffe9b8'],
'armor':['#1a222b','#3c4a57','#6b7c8c','#a3b4c4','#d2dee9','#f6fbff'],
'air':['#06203a','#0b4a7a','#1683c2','#36b4ee','#8ae0ff','#e0f8ff'],
'xp':['#123a05','#2a6b0a','#47a114','#76d22a','#b6f56c','#ecffd0'],
'mana':['#14063a','#2a1478','#4630c2','#6e5cf0','#a99cff','#e6e2ff']}
GOLD=['#3d1f0a','#7a4310','#b86d1c','#e5a43a','#f8d26a','#fff4bf']
STONE=['#16171c','#2d3038','#474b56','#636874','#868c99','#b3b9c4']
SLOT=['#0c0d11','#15161c','#1c1e25','#24262f','#2e313b','#3b3f4b']
ICONS={'heart':['.oo...oo.','owlo.oblo','olbbobbbo','obbbbbbdo','obbbbbbdo','.obbbbdo.','..obbdo..','...odo...','....o....'],
'food':['.....ooo.','....obbbo','...obllbo','...obbbbo','...obbbdo','..owoddo.','.owwoo...','owwo.....','.oo......'],
'armor':['ooo...ooo','oblo.olbo','obbooobbo','.obbwbbo.','.obbwbbo.','.obbwbdo.','.obbbbdo.','.obbbddo.','.ooooooo.'],
'air':['..ooooo..','.obbbbbo.','obwwbbbbo','obwbbbbbo','obbbbbbbo','obbbbbbdo','obbbbbddo','.obbdddo.','..ooooo..'],
'mana':['....o....','...obo...','..obbbo..','.obwbbbo.','.obwbbbo.','obwbbbbdo','obbbbbbdo','.obbbddo.','..ooooo..'],
'coin':['..ooooo..','.obllbbo.','oblbbbbdo','oblbobbdo','oblbobbdo','oblbobbdo','obbbbbbdo','.obbbbdo.','..ooooo..'],
'clock':['..ooooo..','.owwwwwo.','owwwowwwo','owwwowwwo','owwwoodwo','owwwwwwwo','owdwwwdwo','.owwwwwo.','..ooooo..'],
'pin':['...ooo...','..obbbo..','.obbwbbo.','.obwwwbo.','.obbwbbo.','..obbdo..','..obbdo..','...obo...','....o....']}
PIPS={'armor':['ooooooo','owbbbdo','olbbbdo','.obbbo.','.obbdo.','..obo..','...o...'],
'air':['..ooo..','.owbbo.','owbbbdo','obbbbdo','obbbddo','.obddo.','..ooo..']}
EMPTY=['#0c0d11','#1c1e25','#24262f','#2e313b','#3b3f4b','#4a4e5a']
CLOCK=['#3a3f47','#7a828e','#a9b1bc','#d0d6de','#eef1f5','#ffffff']
GEMB=['#07202e','#0a4a66','#0e7aa6','#1ca9d8','#6fd8ff','#dff7ff']

def hotbar(cv,x,y,frame,slot,sel,nums=False,gap=False):
    # 182x22 texture
    cv.rect(x,y,182,22,frame[0])
    cv.rect(x+1,y+1,180,20,frame[2])
    cv.hline(x+1,y+1,180,frame[4]); cv.hline(x+1,y+20,180,frame[1])
    for i in range(9):
        sx=x+1+i*20
        cv.rect(sx+1,y+2,18,18,slot[0])
        cv.rect(sx+2,y+3,16,16,slot[3])
        cv.hline(sx+2,y+3,16,slot[1]); cv.vline(sx+2,y+3,16,slot[1])
        cv.hline(sx+2,y+18,16,slot[4]); cv.vline(sx+17,y+3,16,slot[4])
        if nums: text(cv,str(i+1),sx+3,y+4,'#5d6474',False,TINY)
    sx=x+1+0*20  # selected slot 0 (drawn over as 24x24 at -1)
    s=sel; X=x-1; Y=y-1
    cv.rect(X,Y,24,1,s[0]);cv.rect(X,Y+23,24,1,s[0]);cv.rect(X,Y,1,24,s[0]);cv.rect(X+23,Y,1,24,s[0])
    for k,c in ((1,s[4]),(2,s[3])):
        cv.rect(X+k,Y+k,22-2*(k-1)-0,1,c);cv.rect(X+k,Y+22-k+1-1,22-2*(k-1),1,s[2] if k==1 else c)
        cv.rect(X+k,Y+k,1,22-2*(k-1),c);cv.rect(X+22-k+1-1,Y+k,1,22-2*(k-1),s[2] if k==1 else c)
    cv.px(X+1,Y+1,s[5])

def fillbar(cv,x,y,w,h,R,frac,seg=0):
    fw=int(w*frac)
    for j in range(h):
        c=R[4] if j==0 else (R[2] if j==h-1 else R[3])
        if h>=5 and j==1: c=R[4]
        cv.hline(x,y+j,fw,c)
    if h>=4: cv.hline(x,y,max(0,fw-1),R[5]) if False else None
    cv.px(x,y,R[5])
    if seg:
        for sx in range(x+seg,x+fw,seg+1): cv.vline(sx,y,h,R[1])
    if fw<w: cv.vline(x+fw-1,y,h,R[2])

# ───────────── Concept A: Twin Crest (fantasy) ─────────────
def diamond(cv,cx,cy,r,frameR,trimR,liquid,frac,icon):
    # outer outline / trim / frame ring / inner glass
    def inD(x,y,rr): return abs(x-cx)+abs(y-cy)<=rr
    for y in range(cy-r-1,cy+r+2):
        for x in range(cx-r-1,cx+r+2):
            d=abs(x-cx)+abs(y-cy)
            if d>r: continue
            if d==r: cv.px(x,y,trimR[0]); continue
            if d>=r-2:  # gold trim, lit from top-left
                up=(x-cx)+(y-cy)<0
                cv.px(x,y,trimR[4] if up and d==r-1 else (trimR[3] if up else trimR[2])); continue
            if d>=r-5:
                up=(x-cx)+(y-cy)<0
                cv.px(x,y,frameR[4] if (up and d==r-3) else frameR[3] if up else frameR[2] if d>r-5 else frameR[1]); continue
            if d==r-6: cv.px(x,y,frameR[0]); continue
            # glass interior
            top=cy-(r-7); bot=cy+(r-7); level=bot-int((bot-top)*frac)
            if y>=level:
                # liquid shading: left lit
                k=(x-cx)
                c=liquid[4] if k<-(r-9)//2 else liquid[3] if k<(r-9)//3 else liquid[2]
                if y==level: c=liquid[5] if x%2==0 else liquid[4]
                cv.px(x,y,c)
            else: cv.px(x,y,'#140f18')
    # glass glint
    cv.px(cx-12,cy,'#ffffff'); cv.px(cx-11,cy-1,'#ffffff'); cv.px(cx-10,cy-2,liquid[5])
    # rivets at 4 tips on gold trim
    for dx,dy in ((0,-(r-1)),(0,r-1),(-(r-1),0),(r-1,0)): cv.px(cx+dx,cy+dy,trimR[5])

def conceptA():
    bg=background(); hud=Cv()
    hx_,hy=149,246
    # ledge across the top of the hotbar (stone with gold lip) holding XP groove
    lx,ly,lw,lh=143,236,194,11
    hud.bevel(lx,ly,lw,lh,STONE)
    hud.hline(lx+1,ly+1,lw-2,GOLD[4]); hud.hline(lx+1,ly+2,lw-2,GOLD[2])
    # stone joints
    for jx in range(lx+12,lx+lw-4,16): hud.vline(jx,ly+3,lh-4,STONE[2]); hud.vline(jx+1,ly+3,lh-4,STONE[4])
    # xp groove
    gx,gy,gw,gh=lx+8,ly+5,lw-16,4
    hud.rect(gx-1,gy-1,gw+2,gh+2,STONE[0]); hud.rect(gx,gy,gw,gh,'#0d0b10')
    fillbar(hud,gx,gy,gw,gh,ST['xp'],.62,seg=0)
    # hotbar
    hotbar(hud,hx_,hy,STONE,SLOT,GOLD)
    # level plaque (gold shield) center top
    px_,py_=226,225
    hud.bevel(px_,py_,28,12,GOLD,rim=1)
    hud.rect(px_+3,py_+3,22,6,'#1a1206')
    text(hud,'27',px_+9,py_+3,'#8cff3a',True)
    hud.px(px_+13,py_+12,GOLD[0]);hud.px(px_+14,py_+12,GOLD[0])
    # pips standing on the ledge
    for i in range(10):
        hud.sprite(PIPS['armor'],148+i*8,229,ST['armor'] if i<7 else EMPTY)
        hud.sprite(PIPS['air'],258+i*8,229,ST['air'] if i>1 else EMPTY)
    # twin diamond orbs
    for cx,ic,R,fr,v in ((126,'heart',ST['hp'],.78,'16'),(354,'food',ST['food'],.6,'13')):
        diamond(hud,cx,245,23,STONE,GOLD,R,fr,ic)
        hud.sprite(ICONS[ic],cx-4,232,R)
        text(hud,v,cx-tw(v)//2,246,'#ffffff')
        # arm joining orb to ledge
    hud.rect(146,238,2,8,GOLD[2]); hud.rect(332,238,2,8,GOLD[2])
    out=shadow(hud); bg.blit(out); return bg

# ───────────── Concept B: Clean Strip (modern flat) ─────────────
INK=(18,16,20,225); INK2=(10,9,12,240)
def strip(cv,x,y,w,h,col=INK):
    cv.rect(x,y,w,h,col)
def segbar(cv,x,y,w,h,R,frac,seg=5,rev=False):
    cv.rect(x-1,y-1,w+2,h+2,INK2); cv.rect(x,y,w,h,(40,36,44,255))
    n=w//seg; on=int(round(n*frac))
    for i in range(n):
        sx=x+i*seg if not rev else x+w-(i+1)*seg
        if i<on:
            cv.rect(sx,y,seg-1,h,R[3]); cv.hline(sx,y,seg-1,R[4]); cv.hline(sx,y+h-1,seg-1,R[2]); cv.px(sx,y,R[5])
        else:
            cv.rect(sx,y,seg-1,h,(54,50,60,255))
def conceptB():
    bg=background(); hud=Cv()
    FL=['#0a090c','#141217','#1e1b22','#2a2630','#3a3542','#4e485a']
    SL=['#0a090c','#2a2630','#1e1b22','#5a5468','#6c6680','#8a84a0']
    # flat hotbar
    x,y=149,246
    hud.rect(x,y,182,22,INK)
    for i in range(9):
        sx=x+1+i*20
        hud.rect(sx+1,y+1,20-2,20,(255,255,255,26)); hud.rect(sx+2,y+2,16,18,(0,0,0,60))
        hud.hline(sx+2,y+19,16,(255,255,255,30))
    Y=['#3a2a06','#8a6410','#d9a21e','#ffd34a','#ffe68a','#fff6cc']
    for k in range(2): 
        hud.rect(x-1+k,y-1+k,24-2*k,1,Y[3]); hud.rect(x-1+k,y+22-k,24-2*k,1,Y[2]); hud.rect(x-1+k,y-1+k,1,24-2*k,Y[3]); hud.rect(x+22-k,y-1+k,1,24-2*k,Y[2])
    # xp thin line + level
    hud.rect(x,y-4,182,3,INK2); 
    fw=int(180*.62); hud.hline(x+1,y-3,fw,ST['xp'][4]); hud.hline(x+1,y-2,fw,ST['xp'][3])
    hud.rect(232,y-13,17,10,INK2); text(hud,'27',234,y-12,'#8cff3a')
    # left: hp (big) + armor (thin)
    segbar(hud,151,y-11,78,5,ST['hp'],.8)
    segbar(hud,151,y-18,78,3,ST['armor'],.7)
    hud.rect(136,y-19,13,13,INK2); hud.sprite(ICONS['heart'],138,y-17,ST['hp'])
    # right: food + air
    segbar(hud,252,y-11,78,5,ST['food'],.65,rev=True)
    segbar(hud,252,y-18,78,3,ST['air'],1.0,rev=True)
    hud.rect(332,y-19,13,13,INK2); hud.sprite(ICONS['food'],334,y-17,ST['food'])
    # top-right info strips
    rows=[('clock','14:30',CLOCK),('coin','12.4k',GOLD),('pin','130 64 -500',ST['hp'])]
    for i,(ic,t,R) in enumerate(rows):
        w=tw(t)+18; X=474-w; Yy=6+i*13
        strip(hud,X,Yy,w,11); hud.rect(X,Yy,1,11,R[3])
        hud.sprite(ICONS[ic],X+3,Yy+1,R); text(hud,t,X+14,Yy+2,'#f0eef5')
    # top-left: name + mana
    strip(hud,6,6,74,11); hud.rect(6,6,1,11,ST['mana'][3])
    text(hud,'Steve',11,8,'#ffffff'); hud.rect(46,8,30,7,INK2); text(hud,'LV',48,8,'#8cff3a'); text(hud,'27',61,8,'#8cff3a')
    hud.rect(6,18,74,8,INK); segbar(hud,17,20,60,4,ST['mana'],.75,seg=4); hud.sprite(['.o.','obo','.o.'],9,20,ST['mana'])
    out=shadow(hud,1,1,(0,0,0,70)); bg.blit(out); return bg

# ───────────── Concept C: Slash Profile (MMO) ─────────────
NAVY=['#070a14','#0f1526','#18213a','#22304f','#33476f','#4f6a99']
CY=['#04222e','#075a78','#0c8db5','#19c2e8','#7fe6ff','#e0faff']
def para(cv,x,y,w,h,sl,col):
    for j in range(h):
        off=(h-1-j)*sl//max(1,h-1) if h>1 else 0
        cv.hline(x+off,y+j,w,col)
def slashbar(cv,x,y,w,h,R,frac,tag,tagx):
    sl=h-1
    # ghost
    para(cv,x+10,y-3,w,h+1,sl,(15,21,38,120))
    # frame
    para(cv,x-2,y-1,w+3,h+2,sl,NAVY[0])
    para(cv,x-1,y,w+1,h,sl,'#0b0f1c')
    fw=int(w*frac)
    for j in range(h):
        off=(h-1-j)*sl//(h-1)
        c=R[4] if j<2 else (R[2] if j>=h-2 else R[3])
        if j==0: c=R[5]
        cv.hline(x+off,y+j,fw,c)
        cv.px(x+off+fw,y+j,R[1])
    # end blade accent
    para(cv,x+w+3,y-1,3,h+2,sl,CY[3]); para(cv,x+w+3,y-1,1,h+2,sl,CY[5])
    # value tab under
    tw_=tw(tag)+8
    para(cv,tagx,y+h+1,tw_,11,0,NAVY[0]); para(cv,tagx+1,y+h+1,tw_-2,10,0,NAVY[2])
    cv.hline(tagx+1,y+h+10,tw_-2,R[3])
    text(cv,tag,tagx+4,y+h+2,'#ffffff')
def conceptC():
    bg=background(); hud=Cv()
    # portrait
    hud.bevel(5,5,32,32,NAVY,rim=1); hud.rect(7,7,28,28,CY[3]); hud.rect(8,8,26,26,NAVY[0])
    head(hud,9,9,3)
    # corner accents
    for (ax,ay) in ((4,4),(34,4),(4,34),(34,34)): hud.rect(ax,ay,4,4,CY[3]); hud.px(ax+1,ay+1,CY[5])
    # level tag
    hud.rect(22,32,22,10,NAVY[0]); hud.rect(23,33,20,8,CY[2]); hud.hline(23,33,20,CY[4]); text(hud,'27',28,34,'#ffffff')
    # name
    text(hud,'Steve',44,6,'#ffffff')
    slashbar(hud,46,16,104,7,ST['hp'],.8,'16/20',118)
    slashbar(hud,46,36,84,6,ST['mana'],.8,'80/100',92)
    # food/armor small row
    hud.sprite(ICONS['food'],44,55,ST['food']); 
    para(hud,56,57,46,4,3,NAVY[0]); para(hud,57,58,30,2,1,ST['food'][3])
    hud.sprite(ICONS['armor'],106,55,ST['armor']); para(hud,118,57,30,4,3,NAVY[0]); para(hud,119,58,20,2,1,ST['armor'][3])
    # hotbar w/ numbers
    hotbar(hud,149,246,NAVY,['#05070d','#121a2e','#0e1424','#141c30','#1b2540','#22304f'],CY,nums=True)
    # split xp + level
    for x0,w in ((149,84),(247,84)):
        hud.rect(x0,238,w,5,NAVY[0]); hud.rect(x0+1,239,w-2,3,'#0b0f1c')
    hud.hline(150,239,82,ST['xp'][4]); hud.hline(150,240,82,ST['xp'][3]); hud.hline(150,241,82,ST['xp'][2])
    hud.hline(248,239,28,ST['xp'][4]); hud.hline(248,240,28,ST['xp'][3]); hud.hline(248,241,28,ST['xp'][2])
    text(hud,'27',235,236,'#8cff3a')
    text(hud,'5,305 / 6,000 XP',332-tw('5,305 / 6,000 XP'),227,'#e8f8d8')
    # bottom-right tabs
    rows=[('coin','12.4k',GOLD),('mana','100',ST['mana']),('clock','14:30',CLOCK)]
    for i,(ic,t,R) in enumerate(rows):
        w=48; X=474-w; Yy=228+i*13
        para(hud,X,Yy,w,11,0,NAVY[0]); para(hud,X+1,Yy+1,w-2,9,0,NAVY[3]); hud.hline(X+1,Yy+1,w-2,NAVY[4])
        hud.rect(X+w-13,Yy+1,12,9,NAVY[1]); hud.sprite(ICONS[ic],X+w-12,Yy+1,R)
        text(hud,t,X+w-16-tw(t),Yy+2,'#ffffff')
        hud.rect(X+w,Yy,2,11,CY[3])
    out=shadow(hud,1,1,(0,0,0,90)); bg.blit(out); return bg

for name,fn in (('A_twin_crest',conceptA),('B_clean_strip',conceptB),('C_slash_profile',conceptC)):
    im=fn().im
    im.resize((960,540),Image.NEAREST).save(name+'.png')
    im.save(name+'_1x.png')
print('done')
